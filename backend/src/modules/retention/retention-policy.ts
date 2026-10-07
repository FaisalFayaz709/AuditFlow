import { AppError } from '../../shared/errors.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { DeletionEntityType } from './retention.schemas.js';

export const RETENTION_POLICY_VERSION = 'retention-purge-v1.0-pass-34';
export const PASS_56_RETENTION_DELETION_RUNTIME_VERSION = 'retention-deletion-legal-hold-runtime-v1.0-pass-56';
export const MIN_PURGE_WAIT_DAYS = 7;
export const ACTIVE_DELETION_REQUEST_STATUSES = ['REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING'] as const;
export const TERMINAL_DELETION_REQUEST_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
export const PURGE_TARGET_ENTITY_TYPES: readonly DeletionEntityType[] = ['EVIDENCE_ITEM', 'REPORT', 'AI_ANALYSIS'];

export const BACKUP_LIMITATION_DISCLOSURE =
  'Permanent purge removes active application content through the approved deletion workflow, but deletion propagates to backups only as backups expire under the configured retention policy.';

export const PROTECTED_ACCOUNTABILITY_RECORDS = [
  'AUDIT_LOG',
  'EVIDENCE_REVIEW',
  'MAPPING_REVIEW',
  'TASK_HISTORY',
  'COMPANY_MEMBER_HISTORY',
  'USER_ACTOR_SNAPSHOT',
] as const;


export const PASS_56_RETENTION_DELETION_RUNTIME_RULES = {
  archiveFirstBeforeDeletionRequest: true,
  permanentPurgeRequiresPolicyControlledBackgroundWorkflow: true,
  permanentPurgeRequiresBackupLimitationAcknowledgement: true,
  permanentPurgeRequiresSeparateApprover: true,
  minimumWaitingPeriodDays: MIN_PURGE_WAIT_DAYS,
  legalHoldBlocksPermanentPurge: true,
  legalHoldDoesNotRestoreNormalAccessByItself: true,
  actorAttributionIsNeverErasedByUserRemoval: true,
  auditLogsRetainedWithRelatedBusinessRecord: true,
  backupsExpireUnderProviderRetention: true,
} as const;

export const ACCOUNTABILITY_ATTRIBUTION_RULES = {
  preserveAuditLogRows: true,
  allowNullableUserForeignKeyOnlyWithActorSnapshot: true,
  preserveUploaderReviewerRequesterApproverSnapshots: true,
  neverHardDeleteHistoricalActorAttribution: true,
} as const;

export const ARCHIVE_FIRST_ENTITY_BEHAVIOR = {
  EVIDENCE_ITEM: 'set archived_at, keep versions historically traceable, and defer binary/content purge until approved background workflow',
  REPORT: 'expire report and defer object/content purge until approved background workflow',
  AI_ANALYSIS: 'remove active summary visibility and defer structured-result purge until approved background workflow',
} as const satisfies Record<DeletionEntityType, string>;

export function buildRetentionWorkflowAuditMetadata(params: {
  entityType: DeletionEntityType | string;
  entityId: string;
  stage: 'REQUESTED' | 'APPROVED' | 'CANCELLED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'LEGAL_HOLD_PLACED' | 'LEGAL_HOLD_RELEASED';
  extra?: Record<string, unknown>;
}) {
  return {
    entityType: params.entityType,
    entityId: params.entityId,
    stage: params.stage,
    archiveFirst: true,
    policyVersion: RETENTION_POLICY_VERSION,
    runtimeVersion: PASS_56_RETENTION_DELETION_RUNTIME_VERSION,
    backupLimitationDisclosure: BACKUP_LIMITATION_DISCLOSURE,
    legalHoldBlocksPurge: true,
    actorAttributionPreserved: true,
    ...params.extra,
  };
}

export function assertActorAttributionPreserved(params: {
  actorSnapshotStored: boolean;
  userRemovalErasesHistoricalAttribution: boolean;
}) {
  if (!params.actorSnapshotStored || params.userRemovalErasesHistoricalAttribution) {
    throw new AppError({
      statusCode: 409,
      code: 'ACTOR_ATTRIBUTION_RETENTION_REQUIRED',
      message: 'User removal must not erase historical actor attribution; retain immutable audit/review/upload/request attribution or actor snapshots.',
      details: [
        { field: 'actorSnapshotStored', reason: String(params.actorSnapshotStored) },
        { field: 'userRemovalErasesHistoricalAttribution', reason: String(params.userRemovalErasesHistoricalAttribution) },
      ],
    });
  }
}

export function assertPass56RetentionRuntimeContract() {
  assertActorAttributionPreserved({ actorSnapshotStored: true, userRemovalErasesHistoricalAttribution: false });
  return {
    runtimeVersion: PASS_56_RETENTION_DELETION_RUNTIME_VERSION,
    rules: PASS_56_RETENTION_DELETION_RUNTIME_RULES,
    policy: retentionPolicyDisclosure(),
    archiveFirstEntityBehavior: ARCHIVE_FIRST_ENTITY_BEHAVIOR,
    accountabilityAttributionRules: ACCOUNTABILITY_ATTRIBUTION_RULES,
  };
}

export function isSupportedPurgeTarget(entityType: string): entityType is DeletionEntityType {
  return (PURGE_TARGET_ENTITY_TYPES as readonly string[]).includes(entityType);
}

export function isActiveDeletionRequestStatus(status: string): boolean {
  return (ACTIVE_DELETION_REQUEST_STATUSES as readonly string[]).includes(status);
}

export function calculateEarliestExecuteAfter(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + MIN_PURGE_WAIT_DAYS);
  return next;
}

export function choosePolicyExecuteAfter(requested: Date | null | undefined, now: Date = new Date()): Date {
  const minimum = calculateEarliestExecuteAfter(now);
  return requested && requested > minimum ? requested : minimum;
}

export function assertDeletionApprovalPolicy(params: { tenant: TenantContext; requestedByUserId: string }) {
  if (params.tenant.userId === params.requestedByUserId) {
    throw new AppError({
      statusCode: 409,
      code: 'DELETION_REQUEST_SELF_APPROVAL_BLOCKED',
      message: 'The requester cannot approve the same permanent purge request. A separate authorized user must approve it.',
      details: [{ field: 'approvedByUserId', reason: 'must differ from requestedByUserId' }],
    });
  }
}

export function retentionPolicyDisclosure() {
  return {
    policyVersion: RETENTION_POLICY_VERSION,
    archiveFirst: true,
    permanentPurgeRequiresRequest: true,
    permanentPurgeRequiresApproval: true,
    minimumPurgeWaitDays: MIN_PURGE_WAIT_DAYS,
    legalHoldBlocksPurge: true,
    backupLimitationDisclosure: BACKUP_LIMITATION_DISCLOSURE,
    protectedAccountabilityRecords: PROTECTED_ACCOUNTABILITY_RECORDS,
    supportedPurgeTargets: PURGE_TARGET_ENTITY_TYPES,
    requesterMayApproveOwnRequest: false,
    runtimeVersion: PASS_56_RETENTION_DELETION_RUNTIME_VERSION,
    runtimeRules: PASS_56_RETENTION_DELETION_RUNTIME_RULES,
    archiveFirstEntityBehavior: ARCHIVE_FIRST_ENTITY_BEHAVIOR,
    accountabilityAttributionRules: ACCOUNTABILITY_ATTRIBUTION_RULES,
  };
}

export function purgedStorageReference(entityId: string) {
  return `purged/${entityId}`;
}
