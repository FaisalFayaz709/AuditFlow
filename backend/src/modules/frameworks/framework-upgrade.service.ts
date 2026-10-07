import type { Prisma, PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { assertExactlyOneRowUpdated } from '../../shared/concurrency.js';
import { requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { FrameworkUpgradeActivateBody, FrameworkUpgradePreviewBody } from './framework.schemas.js';
import { validateFrameworkVersionForPublication } from './frameworks.service.js';

type FrameworkUpgradeClient = PrismaClient | Prisma.TransactionClient;

type ControlForReconciliation = {
  id: string;
  code: string;
  title: string;
  risk_level: string;
  control_type: string;
  sort_order: number;
  evidence_requirements: Array<{
    id: string;
    code: string;
    name: string;
    required: boolean;
    requirement_type: string;
    validity_days: number | null;
  }>;
};

type CompanyControlForReconciliation = {
  id: string;
  control_id: string;
  applicability: string;
  not_applicable_reason: string | null;
  not_applicable_approved_by: string | null;
  owner_user_id: string | null;
  control: ControlForReconciliation;
};

function indexBy<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [getKey(item), item]));
}

function requirementMap(control: ControlForReconciliation): Map<string, ControlForReconciliation['evidence_requirements'][number]> {
  return indexBy(control.evidence_requirements, (requirement) => requirement.code);
}

function controlMaterialChange(oldControl: ControlForReconciliation, newControl: ControlForReconciliation) {
  const changes: Record<string, { old: unknown; next: unknown }> = {};
  if (oldControl.title !== newControl.title) changes.title = { old: oldControl.title, next: newControl.title };
  if (oldControl.risk_level !== newControl.risk_level) changes.riskLevel = { old: oldControl.risk_level, next: newControl.risk_level };
  if (oldControl.control_type !== newControl.control_type) changes.controlType = { old: oldControl.control_type, next: newControl.control_type };
  return changes;
}

function requirementMaterialChange(
  oldRequirement: ControlForReconciliation['evidence_requirements'][number],
  newRequirement: ControlForReconciliation['evidence_requirements'][number],
) {
  const changes: Record<string, { old: unknown; next: unknown }> = {};
  if (oldRequirement.name !== newRequirement.name) changes.name = { old: oldRequirement.name, next: newRequirement.name };
  if (oldRequirement.required !== newRequirement.required) changes.required = { old: oldRequirement.required, next: newRequirement.required };
  if (oldRequirement.requirement_type !== newRequirement.requirement_type) changes.requirementType = { old: oldRequirement.requirement_type, next: newRequirement.requirement_type };
  if (oldRequirement.validity_days !== newRequirement.validity_days) changes.validityDays = { old: oldRequirement.validity_days, next: newRequirement.validity_days };
  return changes;
}

function countByMatchType(rows: Array<{ match_type: string }>) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.match_type] = (counts[row.match_type] ?? 0) + 1;
    return counts;
  }, {});
}

export class FrameworkUpgradeService {
  constructor(private readonly prisma: PrismaClient) {}

  async createUpgradePreview(params: {
    tenant: TenantContext;
    oldEnrollmentId: string;
    body: FrameworkUpgradePreviewBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }) {
    requirePermission(params.tenant, 'frameworks.enable');

    return this.prisma.$transaction(async (tx) => {
      const oldEnrollment = await this.findActiveEnrollmentForUpgrade(tx, params.tenant, params.oldEnrollmentId);
      const targetVersion = await this.findTargetVersion(tx, params.body.targetFrameworkVersionId);

      if (targetVersion.framework_id !== oldEnrollment.framework_id) {
        throw new AppError({
          statusCode: 422,
          code: 'FRAMEWORK_UPGRADE_REQUIRES_SAME_FAMILY',
          message: 'Framework upgrades must target a published version in the same framework family.',
          details: [{ field: 'targetFrameworkVersionId', reason: params.body.targetFrameworkVersionId }],
        });
      }

      if (targetVersion.id === oldEnrollment.framework_version_id) {
        throw new AppError({
          statusCode: 409,
          code: 'FRAMEWORK_UPGRADE_TARGET_ALREADY_ACTIVE',
          message: 'The target framework version is already the active enrollment version.',
        });
      }

      validateFrameworkVersionForPublication(targetVersion);

      const existingDraft = await tx.companyFramework.findFirst({
        where: {
          company_id: params.tenant.companyId,
          framework_id: oldEnrollment.framework_id,
          status: 'DRAFT_RECONCILIATION',
        },
        select: { id: true },
      });
      if (existingDraft) {
        throw new AppError({
          statusCode: 409,
          code: 'FRAMEWORK_UPGRADE_DRAFT_EXISTS',
          message: 'A framework upgrade reconciliation draft already exists for this framework family.',
          details: [{ field: 'draftEnrollmentId', reason: existingDraft.id }],
        });
      }

      const oldControlsByCode = indexBy(oldEnrollment.company_controls, (companyControl) => companyControl.control.code);
      const targetControlsByCode = indexBy(targetVersion.controls, (control) => control.code);

      const draftEnrollment = await tx.companyFramework.create({
        data: {
          company_id: params.tenant.companyId,
          framework_id: targetVersion.framework_id,
          framework_version_id: targetVersion.id,
          status: 'DRAFT_RECONCILIATION',
          target_audit_date: oldEnrollment.target_audit_date,
          company_controls: {
            create: targetVersion.controls.map((newControl) => {
              const oldCompanyControl = oldControlsByCode.get(newControl.code);
              return {
                control_id: newControl.id,
                applicability: oldCompanyControl?.applicability ?? 'APPLICABLE',
                not_applicable_reason: oldCompanyControl?.not_applicable_reason ?? null,
                not_applicable_approved_by: oldCompanyControl?.not_applicable_approved_by ?? null,
                owner_user_id: oldCompanyControl?.owner_user_id ?? null,
              };
            }),
          },
        },
        select: { id: true, status: true, framework_version_id: true, started_at: true, target_audit_date: true },
      });

      const reconciliation = await tx.frameworkUpgradeReconciliation.create({
        data: {
          company_id: params.tenant.companyId,
          old_company_framework_id: oldEnrollment.id,
          new_company_framework_id: draftEnrollment.id,
          target_framework_version_id: targetVersion.id,
          status: 'OPEN',
          created_by_user_id: params.tenant.userId,
          preview_json: {
            sourceFrameworkVersionId: oldEnrollment.framework_version_id,
            targetFrameworkVersionId: targetVersion.id,
            proposedApplicabilityAndOwnersRequireReview: true,
            compatibleMappingsAreCandidatesOnly: true,
            openTasksRemainOnOldEnrollment: true,
          },
        },
        select: { id: true, status: true, created_at: true },
      });

      const controlMatches = [] as Prisma.FrameworkUpgradeControlMatchCreateManyInput[];
      for (const oldCompanyControl of oldEnrollment.company_controls) {
        const oldControl = oldCompanyControl.control;
        const newControl = targetControlsByCode.get(oldControl.code);
        if (!newControl) {
          controlMatches.push({
            reconciliation_id: reconciliation.id,
            match_type: 'REMOVED',
            stable_code: oldControl.code,
            old_control_id: oldControl.id,
            materially_changed: false,
            change_summary_json: {},
          });
          continue;
        }
        const changes = controlMaterialChange(oldControl, newControl);
        controlMatches.push({
          reconciliation_id: reconciliation.id,
          match_type: Object.keys(changes).length ? 'MATERIALLY_CHANGED' : 'MATCHED',
          stable_code: oldControl.code,
          old_control_id: oldControl.id,
          new_control_id: newControl.id,
          materially_changed: Object.keys(changes).length > 0,
          change_summary_json: changes,
        });
      }
      for (const newControl of targetVersion.controls) {
        if (!oldControlsByCode.has(newControl.code)) {
          controlMatches.push({
            reconciliation_id: reconciliation.id,
            match_type: 'ADDED',
            stable_code: newControl.code,
            new_control_id: newControl.id,
            materially_changed: false,
            change_summary_json: {},
          });
        }
      }
      if (controlMatches.length) await tx.frameworkUpgradeControlMatch.createMany({ data: controlMatches });

      const requirementMatches = [] as Prisma.FrameworkUpgradeRequirementMatchCreateManyInput[];
      for (const oldCompanyControl of oldEnrollment.company_controls) {
        const oldControl = oldCompanyControl.control;
        const newControl = targetControlsByCode.get(oldControl.code);
        const oldReqs = requirementMap(oldControl);
        const newReqs = newControl ? requirementMap(newControl) : new Map<string, ControlForReconciliation['evidence_requirements'][number]>();

        for (const oldRequirement of oldControl.evidence_requirements) {
          const newRequirement = newReqs.get(oldRequirement.code);
          if (!newRequirement) {
            requirementMatches.push({
              reconciliation_id: reconciliation.id,
              match_type: 'REMOVED',
              stable_control_code: oldControl.code,
              stable_requirement_code: oldRequirement.code,
              old_requirement_id: oldRequirement.id,
              old_control_id: oldControl.id,
              materially_changed: false,
              change_summary_json: {},
            });
            continue;
          }
          const changes = requirementMaterialChange(oldRequirement, newRequirement);
          requirementMatches.push({
            reconciliation_id: reconciliation.id,
            match_type: Object.keys(changes).length ? 'MATERIALLY_CHANGED' : 'MATCHED',
            stable_control_code: oldControl.code,
            stable_requirement_code: oldRequirement.code,
            old_requirement_id: oldRequirement.id,
            new_requirement_id: newRequirement.id,
            old_control_id: oldControl.id,
            new_control_id: newControl?.id,
            materially_changed: Object.keys(changes).length > 0,
            change_summary_json: changes,
          });
        }

        if (newControl) {
          for (const newRequirement of newControl.evidence_requirements) {
            if (!oldReqs.has(newRequirement.code)) {
              requirementMatches.push({
                reconciliation_id: reconciliation.id,
                match_type: 'ADDED',
                stable_control_code: newControl.code,
                stable_requirement_code: newRequirement.code,
                new_requirement_id: newRequirement.id,
                new_control_id: newControl.id,
                materially_changed: false,
                change_summary_json: {},
              });
            }
          }
        }
      }
      for (const newControl of targetVersion.controls) {
        if (oldControlsByCode.has(newControl.code)) continue;
        for (const newRequirement of newControl.evidence_requirements) {
          requirementMatches.push({
            reconciliation_id: reconciliation.id,
            match_type: 'ADDED',
            stable_control_code: newControl.code,
            stable_requirement_code: newRequirement.code,
            new_requirement_id: newRequirement.id,
            new_control_id: newControl.id,
            materially_changed: false,
            change_summary_json: {},
          });
        }
      }
      if (requirementMatches.length) await tx.frameworkUpgradeRequirementMatch.createMany({ data: requirementMatches });

      const mappingCandidates = await this.createMappingCandidates({
        tx,
        tenant: params.tenant,
        reconciliationId: reconciliation.id,
        oldControlsByCode,
        targetControlsByCode,
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'FRAMEWORK_UPGRADE_STARTED',
        entityType: 'company_framework',
        entityId: draftEnrollment.id,
        metadata: {
          oldEnrollmentId: oldEnrollment.id,
          draftEnrollmentId: draftEnrollment.id,
          sourceFrameworkVersionId: oldEnrollment.framework_version_id,
          targetFrameworkVersionId: targetVersion.id,
          controlMatchCounts: countByMatchType(controlMatches),
          requirementMatchCounts: countByMatchType(requirementMatches),
          mappingCandidateCount: mappingCandidates,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        reconciliationId: reconciliation.id,
        oldEnrollmentId: oldEnrollment.id,
        draftEnrollmentId: draftEnrollment.id,
        status: reconciliation.status,
        draftStatus: draftEnrollment.status,
        sourceFrameworkVersionId: oldEnrollment.framework_version_id,
        targetFrameworkVersionId: targetVersion.id,
        proposedApplicabilityAndOwnersRequireReview: true,
        evidenceMappingsApprovedWithoutReview: false,
        compatibleMappingsCopiedAs: 'PENDING_REVIEW_ON_ACTIVATION',
        openTasksMigrated: false,
        counts: {
          controls: countByMatchType(controlMatches),
          requirements: countByMatchType(requirementMatches),
          mappingCandidates,
        },
        createdAt: reconciliation.created_at.toISOString(),
      };
    });
  }

  async getReconciliation(params: { tenant: TenantContext; draftEnrollmentId: string }) {
    requirePermission(params.tenant, 'frameworks.enable');

    const reconciliation = await this.prisma.frameworkUpgradeReconciliation.findFirst({
      where: { company_id: params.tenant.companyId, new_company_framework_id: params.draftEnrollmentId },
      select: {
        id: true,
        status: true,
        old_company_framework_id: true,
        new_company_framework_id: true,
        target_framework_version_id: true,
        preview_json: true,
        reviewed_at: true,
        activated_at: true,
        created_at: true,
        control_matches: {
          orderBy: [{ stable_code: 'asc' }],
          select: {
            id: true,
            match_type: true,
            stable_code: true,
            old_control_id: true,
            new_control_id: true,
            materially_changed: true,
            change_summary_json: true,
          },
        },
        requirement_matches: {
          orderBy: [{ stable_control_code: 'asc' }, { stable_requirement_code: 'asc' }],
          select: {
            id: true,
            match_type: true,
            stable_control_code: true,
            stable_requirement_code: true,
            old_requirement_id: true,
            new_requirement_id: true,
            materially_changed: true,
            change_summary_json: true,
          },
        },
        mapping_candidates: {
          orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            old_mapping_id: true,
            evidence_version_id: true,
            old_control_id: true,
            old_requirement_id: true,
            new_control_id: true,
            new_requirement_id: true,
            status: true,
            copied_mapping_id: true,
            reason: true,
          },
        },
      },
    });

    if (!reconciliation) {
      throw new AppError({
        statusCode: 404,
        code: 'FRAMEWORK_UPGRADE_RECONCILIATION_NOT_FOUND',
        message: 'Framework upgrade reconciliation was not found in this tenant.',
      });
    }

    return {
      reconciliationId: reconciliation.id,
      status: reconciliation.status,
      oldEnrollmentId: reconciliation.old_company_framework_id,
      draftEnrollmentId: reconciliation.new_company_framework_id,
      targetFrameworkVersionId: reconciliation.target_framework_version_id,
      preview: reconciliation.preview_json,
      reviewedAt: reconciliation.reviewed_at?.toISOString() ?? null,
      activatedAt: reconciliation.activated_at?.toISOString() ?? null,
      createdAt: reconciliation.created_at.toISOString(),
      controls: reconciliation.control_matches.map((row) => ({
        id: row.id,
        matchType: row.match_type,
        stableCode: row.stable_code,
        oldControlId: row.old_control_id,
        newControlId: row.new_control_id,
        materiallyChanged: row.materially_changed,
        changeSummary: row.change_summary_json,
      })),
      requirements: reconciliation.requirement_matches.map((row) => ({
        id: row.id,
        matchType: row.match_type,
        stableControlCode: row.stable_control_code,
        stableRequirementCode: row.stable_requirement_code,
        oldRequirementId: row.old_requirement_id,
        newRequirementId: row.new_requirement_id,
        materiallyChanged: row.materially_changed,
        changeSummary: row.change_summary_json,
      })),
      mappingCandidates: reconciliation.mapping_candidates.map((row) => ({
        id: row.id,
        oldMappingId: row.old_mapping_id,
        evidenceVersionId: row.evidence_version_id,
        oldControlId: row.old_control_id,
        oldRequirementId: row.old_requirement_id,
        newControlId: row.new_control_id,
        newRequirementId: row.new_requirement_id,
        status: row.status,
        copiedMappingId: row.copied_mapping_id,
        reason: row.reason,
      })),
    };
  }

  async activateUpgrade(params: {
    tenant: TenantContext;
    draftEnrollmentId: string;
    body: FrameworkUpgradeActivateBody;
    requestId: string;
    sessionId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }) {
    requirePermission(params.tenant, 'frameworks.enable');

    if (!params.body.reviewedProposedValues) {
      throw new AppError({
        statusCode: 422,
        code: 'FRAMEWORK_UPGRADE_REVIEW_REQUIRED',
        message: 'Authorized review of proposed applicability, owners, and mapping candidates is required before activation.',
        details: [{ field: 'reviewedProposedValues', reason: 'must be true' }],
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const reconciliation = await tx.frameworkUpgradeReconciliation.findFirst({
        where: { company_id: params.tenant.companyId, new_company_framework_id: params.draftEnrollmentId, status: { in: ['OPEN', 'REVIEWED'] } },
        select: {
          id: true,
          old_company_framework_id: true,
          new_company_framework_id: true,
          target_framework_version_id: true,
          mapping_candidates: {
            where: { status: 'PENDING_REVIEW_READY' },
            select: {
              id: true,
              old_mapping_id: true,
              evidence_version_id: true,
              new_control_id: true,
              new_requirement_id: true,
              reason: true,
            },
          },
        },
      });
      if (!reconciliation) {
        throw new AppError({
          statusCode: 404,
          code: 'FRAMEWORK_UPGRADE_RECONCILIATION_NOT_FOUND',
          message: 'Open framework upgrade reconciliation was not found in this tenant.',
        });
      }

      const oldUpdated = await tx.companyFramework.updateMany({
        where: { id: reconciliation.old_company_framework_id, company_id: params.tenant.companyId, status: 'ACTIVE' },
        data: { status: 'ENDED', ended_at: new Date() },
      });
      const draftUpdated = await tx.companyFramework.updateMany({
        where: { id: reconciliation.new_company_framework_id, company_id: params.tenant.companyId, status: 'DRAFT_RECONCILIATION' },
        data: { status: 'ACTIVE', started_at: new Date() },
      });
      if (oldUpdated.count !== 1 || draftUpdated.count !== 1) {
        throw new AppError({
          statusCode: 409,
          code: 'FRAMEWORK_UPGRADE_INVALID_STATE',
          message: 'Framework upgrade activation requires one ACTIVE old enrollment and one DRAFT_RECONCILIATION new enrollment.',
        });
      }

      let copiedMappingCount = 0;
      for (const candidate of reconciliation.mapping_candidates) {
        const copied = await tx.evidenceControlMapping.create({
          data: {
            company_id: params.tenant.companyId,
            evidence_version_id: candidate.evidence_version_id,
            control_id: candidate.new_control_id,
            requirement_id: candidate.new_requirement_id,
            source: 'MANUAL',
            status: 'PENDING_REVIEW',
            reason: candidate.reason ?? 'Copied as a pending-review candidate by framework upgrade reconciliation.',
            mapped_by_user_id: params.tenant.userId,
          },
          select: { id: true },
        });
        copiedMappingCount += 1;
        assertExactlyOneRowUpdated(
          await tx.frameworkUpgradeMappingCandidate.updateMany({
            where: { id: candidate.id, reconciliation_id: reconciliation.id, status: 'PENDING_REVIEW_READY', copied_mapping_id: null },
            data: { status: 'COPIED_PENDING_REVIEW', copied_mapping_id: copied.id },
          }),
          'Framework upgrade mapping candidate changed before it could be copied as pending review.',
          [{ field: 'candidateId', reason: candidate.id }],
        );
      }

      const now = new Date();
      assertExactlyOneRowUpdated(
        await tx.frameworkUpgradeReconciliation.updateMany({
          where: { id: reconciliation.id, company_id: params.tenant.companyId, status: { in: ['OPEN', 'REVIEWED'] }, activated_at: null },
          data: {
            status: 'ACTIVATED',
            reviewed_by_user_id: params.tenant.userId,
            reviewed_at: now,
            activated_by_user_id: params.tenant.userId,
            activated_at: now,
          },
        }),
        'Framework upgrade reconciliation changed before activation could be committed.',
        [{ field: 'expectedStatus', reason: 'OPEN_OR_REVIEWED' }],
      );

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.sessionId,
        action: 'FRAMEWORK_UPGRADED',
        entityType: 'company_framework',
        entityId: reconciliation.new_company_framework_id,
        metadata: {
          reconciliationId: reconciliation.id,
          oldEnrollmentId: reconciliation.old_company_framework_id,
          newEnrollmentId: reconciliation.new_company_framework_id,
          targetFrameworkVersionId: reconciliation.target_framework_version_id,
          compatibleMappingsCopiedAs: 'PENDING_REVIEW',
          copiedMappingCount,
          openTasksMigrated: params.body.migrateOpenTasks === true ? 'explicit-task-migration-not-yet-enabled' : false,
          readinessRecalculated: true,
          readinessRecalculationMode: 'canonical-deterministic-on-read',
          activationNote: params.body.activationNote ?? null,
        },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });

      return {
        reconciliationId: reconciliation.id,
        oldEnrollmentId: reconciliation.old_company_framework_id,
        activeEnrollmentId: reconciliation.new_company_framework_id,
        status: 'ACTIVE',
        priorEnrollmentStatus: 'ENDED',
        copiedMappingCount,
        compatibleMappingsCopiedAs: 'PENDING_REVIEW',
        evidenceMappingsApprovedWithoutReview: false,
        readinessRecalculated: true,
        readinessRecalculationMode: 'canonical-deterministic-on-read',
        activatedAt: now.toISOString(),
      };
    });
  }

  private async findActiveEnrollmentForUpgrade(tx: FrameworkUpgradeClient, tenant: TenantContext, enrollmentId: string) {
    const enrollment = await tx.companyFramework.findFirst({
      where: {
        id: enrollmentId,
        company_id: tenant.companyId,
        status: 'ACTIVE',
        company: { members: { some: { id: tenant.membershipId, user_id: tenant.userId, status: 'ACTIVE' } } },
      },
      select: {
        id: true,
        company_id: true,
        framework_id: true,
        framework_version_id: true,
        status: true,
        target_audit_date: true,
        company_controls: {
          select: {
            id: true,
            control_id: true,
            applicability: true,
            not_applicable_reason: true,
            not_applicable_approved_by: true,
            owner_user_id: true,
            control: {
              select: {
                id: true,
                code: true,
                title: true,
                risk_level: true,
                control_type: true,
                sort_order: true,
                evidence_requirements: {
                  orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
                  select: { id: true, code: true, name: true, required: true, requirement_type: true, validity_days: true },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new AppError({
        statusCode: 404,
        code: 'ACTIVE_FRAMEWORK_ENROLLMENT_NOT_FOUND',
        message: 'Active framework enrollment was not found in this tenant.',
      });
    }

    return enrollment;
  }

  private async findTargetVersion(tx: FrameworkUpgradeClient, targetFrameworkVersionId: string) {
    const targetVersion = await tx.frameworkVersion.findFirst({
      where: { id: targetFrameworkVersionId, status: 'PUBLISHED' },
      select: {
        id: true,
        framework_id: true,
        version: true,
        controls: {
          orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            title: true,
            risk_level: true,
            control_type: true,
            sort_order: true,
            evidence_requirements: {
              orderBy: [{ sort_order: 'asc' }, { code: 'asc' }],
              select: { id: true, code: true, name: true, required: true, requirement_type: true, validity_days: true },
            },
          },
        },
      },
    });

    if (!targetVersion) {
      throw new AppError({
        statusCode: 404,
        code: 'TARGET_FRAMEWORK_VERSION_NOT_FOUND',
        message: 'Published target framework version was not found.',
      });
    }

    return targetVersion;
  }

  private async createMappingCandidates(params: {
    tx: FrameworkUpgradeClient;
    tenant: TenantContext;
    reconciliationId: string;
    oldControlsByCode: Map<string, CompanyControlForReconciliation>;
    targetControlsByCode: Map<string, ControlForReconciliation>;
  }): Promise<number> {
    const oldControlIds = [...params.oldControlsByCode.values()].map((companyControl) => companyControl.control.id);
    if (!oldControlIds.length) return 0;

    const oldMappings = await params.tx.evidenceControlMapping.findMany({
      where: {
        company_id: params.tenant.companyId,
        status: 'APPROVED',
        control_id: { in: oldControlIds },
      },
      select: {
        id: true,
        evidence_version_id: true,
        control_id: true,
        requirement_id: true,
        control: { select: { code: true } },
        requirement: { select: { code: true } },
      },
    });

    const data: Prisma.FrameworkUpgradeMappingCandidateCreateManyInput[] = [];
    for (const oldMapping of oldMappings) {
      const oldControlCode = oldMapping.control.code;
      const newControl = params.targetControlsByCode.get(oldControlCode);
      if (!newControl) continue;

      let newRequirementId: string | null = null;
      if (oldMapping.requirement?.code) {
        newRequirementId = newControl.evidence_requirements.find((requirement) => requirement.code === oldMapping.requirement?.code)?.id ?? null;
        if (!newRequirementId) continue;
      }

      data.push({
        reconciliation_id: params.reconciliationId,
        old_mapping_id: oldMapping.id,
        evidence_version_id: oldMapping.evidence_version_id,
        old_control_id: oldMapping.control_id,
        old_requirement_id: oldMapping.requirement_id,
        new_control_id: newControl.id,
        new_requirement_id: newRequirementId,
        status: 'PENDING_REVIEW_READY',
        reason: 'Compatible mapping candidate copied from matched stable control/requirement codes. Human review is required.',
      });
    }

    if (data.length) await params.tx.frameworkUpgradeMappingCandidate.createMany({ data, skipDuplicates: true });
    return data.length;
  }
}
