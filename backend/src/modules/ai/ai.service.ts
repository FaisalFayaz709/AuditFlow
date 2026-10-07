import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AppEnv } from '../../config/env.js';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { requirePermission } from '../authz/permissions.js';
import { createPrivateObjectStorage } from '../storage/storage.factory.js';
import type { PrivateObjectStorage } from '../storage/storage.types.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import { BasicExtractionAdapter } from './extraction-adapter.js';
import { buildEvidenceAnalysisPrompt } from './prompt-builder.js';
import { MockAiProvider } from './mock-ai-provider.js';
import type { AiEvidenceAnalysisOutput } from './ai-output.schema.js';
import { assertAiReleaseGateForRuntime, validateAiEvidenceAnalysisOutput } from './evaluation/evaluation-policy.js';
import { filterAiSuggestedMappings } from './ai-suggestion-policy.js';
import type { AiCandidateControl, AiProvider } from './ai.types.js';
import { readAiSettings, writeAiSettings } from './ai-settings.js';
import type { AiSettingsBody } from './ai.schemas.js';

export type AiAuditContext = {
  requestId: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
};

function hashInput(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function toDecimalConfidence(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function isJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export class AiService {
  private readonly storage: PrivateObjectStorage;
  private readonly provider: AiProvider;

  constructor(private readonly prisma: PrismaClient, private readonly env: AppEnv, storage?: PrivateObjectStorage, provider?: AiProvider) {
    this.storage = storage ?? createPrivateObjectStorage(env);
    this.provider = provider ?? new MockAiProvider(env.AI_MODEL_NAME);
  }

  async getCompanyAiSettings(tenant: TenantContext) {
    requirePermission(tenant, 'company.read');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: tenant.companyId }, select: { settings_json: true } });
    return readAiSettings(isJsonObject(company.settings_json as Prisma.JsonValue), this.env);
  }

  async updateCompanyAiSettings(params: { tenant: TenantContext; body: AiSettingsBody; audit: AiAuditContext }) {
    requirePermission(params.tenant, 'company.update');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: params.tenant.companyId }, select: { settings_json: true } });
    const nextSettings = writeAiSettings(isJsonObject(company.settings_json as Prisma.JsonValue), params.body);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.company.update({
        where: { id: params.tenant.companyId },
        data: { settings_json: nextSettings },
        select: { settings_json: true },
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'AI_SETTINGS_UPDATED',
        entityType: 'company',
        entityId: params.tenant.companyId,
        metadata: { ai: params.body },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return saved;
    });
    return readAiSettings(isJsonObject(updated.settings_json as Prisma.JsonValue), this.env);
  }

  async listAnalyses(params: { tenant: TenantContext; versionId: string }) {
    requirePermission(params.tenant, 'ai.read');
    await this.requireEvidenceVersionInTenant(params.tenant, params.versionId);
    return this.prisma.aiAnalysis.findMany({
      where: { company_id: params.tenant.companyId, evidence_version_id: params.versionId },
      orderBy: { created_at: 'desc' },
    });
  }

  async runAnalysis(params: { tenant: TenantContext; versionId: string; audit: AiAuditContext }) {
    requirePermission(params.tenant, 'ai.run');

    if (this.env.AI_PROVIDER === 'disabled') {
      throw new AppError({ statusCode: 422, code: 'AI_PROVIDER_DISABLED', message: 'AI provider is disabled for this environment.' });
    }
    assertAiReleaseGateForRuntime(this.env);

    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: params.tenant.companyId }, select: { settings_json: true } });
    const settings = readAiSettings(isJsonObject(company.settings_json as Prisma.JsonValue), this.env);
    if (!settings.enabled) {
      throw new AppError({ statusCode: 422, code: 'AI_DISABLED_FOR_COMPANY', message: 'AI is disabled for this company.' });
    }

    const version = await this.requireEvidenceVersionInTenant(params.tenant, params.versionId);
    if (version.status === 'SECURITY_REJECTED' || version.status === 'QUARANTINED' || version.status === 'ARCHIVED') {
      throw new AppError({
        statusCode: 409,
        code: 'AI_ANALYSIS_BLOCKED_BY_EVIDENCE_STATE',
        message: 'AI analysis cannot run for quarantined, security-rejected, or archived evidence.',
        details: [{ field: 'status', reason: version.status }],
      });
    }
    if (version.evidence_item.sensitivity_level === 'RESTRICTED' && !settings.allowRestrictedEvidence) {
      throw new AppError({
        statusCode: 422,
        code: 'AI_RESTRICTED_EVIDENCE_BLOCKED',
        message: 'Restricted evidence is excluded from AI analysis unless explicitly enabled by company setting.',
      });
    }

    const candidates = await this.loadCandidateControls(params.tenant.companyId);
    const extraction = await new BasicExtractionAdapter(this.storage, this.env.AI_MAX_INPUT_CHARS).extract(version);
    const prompt = buildEvidenceAnalysisPrompt({
      promptVersion: this.env.AI_PROMPT_VERSION,
      fileName: version.file_name,
      mimeType: version.mime_type,
      candidateControls: candidates,
      untrustedDocumentText: extraction.text,
    });
    const inputHash = hashInput(`${version.id}:${version.sha256_checksum}:${this.env.AI_PROMPT_VERSION}:${prompt}`);
    const startedAt = Date.now();

    const analysis = await this.prisma.$transaction(async (tx) => {
      const created = await tx.aiAnalysis.create({
        data: {
          company_id: params.tenant.companyId,
          evidence_version_id: version.id,
          provider: this.env.AI_PROVIDER,
          model_name: this.env.AI_MODEL_NAME,
          prompt_version: this.env.AI_PROMPT_VERSION,
          input_hash: inputHash,
          status: 'REQUESTED',
        },
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        sessionId: params.audit.sessionId,
        action: 'AI_ANALYSIS_REQUESTED',
        entityType: 'ai_analysis',
        entityId: created.id,
        metadata: { evidenceVersionId: version.id, promptVersion: this.env.AI_PROMPT_VERSION, extractionSource: extraction.source, extractionTruncated: extraction.truncated },
        actorSnapshot: { role: params.tenant.role },
        ipAddress: params.audit.ipAddress,
        userAgent: params.audit.userAgent,
        requestId: params.audit.requestId,
      });
      return created;
    });

    try {
      await this.prisma.aiAnalysis.update({ where: { id: analysis.id }, data: { status: 'PROCESSING' } });
      const { providerResponse, output, structuredRetryCount } = await this.runProviderWithStructuredValidation({
        promptVersion: this.env.AI_PROMPT_VERSION,
        prompt,
        untrustedDocumentText: extraction.text,
        fileName: version.file_name,
        mimeType: version.mime_type,
        candidateControls: candidates,
      });
      const mappingResult = await this.createSuggestedMappings({ tenant: params.tenant, versionId: version.id, output, candidates });
      const createdSuggestions = mappingResult.created;
      const completed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.aiAnalysis.update({
          where: { id: analysis.id },
          data: {
            provider: providerResponse.provider,
            model_name: providerResponse.modelName,
            status: 'COMPLETED',
            document_type: output.documentType,
            structured_result_json: output as unknown as Prisma.InputJsonValue,
            summary: output.summary,
            completed_at: new Date(),
            latency_ms: Date.now() - startedAt,
            token_usage_json: { ...(providerResponse.tokenUsage ?? {}), structuredRetryCount } as Prisma.InputJsonValue,
          },
        });
        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: 'AI_ANALYSIS_COMPLETED',
          entityType: 'ai_analysis',
          entityId: updated.id,
          metadata: {
            evidenceVersionId: version.id,
            documentType: output.documentType,
            suggestedMappingCount: createdSuggestions,
            ignoredUnknownControlCodeCount: mappingResult.ignoredUnknownControlCodeCount,
            ignoredUnknownRequirementCodeCount: mappingResult.ignoredUnknownRequirementCodeCount,
            structuredRetryCount,
            missingInformationCount: output.missingInformation.length,
          },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });
        return updated;
      });
      return { analysis: completed, suggestedMappingCount: createdSuggestions };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown AI failure';
      const failed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.aiAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: 'FAILED',
            error_code: error instanceof AppError ? error.code : 'AI_ANALYSIS_FAILED',
            error_message: message.slice(0, 1000),
            completed_at: new Date(),
            latency_ms: Date.now() - startedAt,
          },
        });
        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          sessionId: params.audit.sessionId,
          action: 'AI_ANALYSIS_FAILED',
          entityType: 'ai_analysis',
          entityId: updated.id,
          metadata: { evidenceVersionId: version.id, errorCode: updated.error_code },
          actorSnapshot: { role: params.tenant.role },
          ipAddress: params.audit.ipAddress,
          userAgent: params.audit.userAgent,
          requestId: params.audit.requestId,
        });
        return updated;
      });
      if (error instanceof AppError) throw error;
      return { analysis: failed, suggestedMappingCount: 0 };
    }
  }

  private async requireEvidenceVersionInTenant(tenant: TenantContext, versionId: string) {
    const version = await this.prisma.evidenceVersion.findFirst({
      where: { id: versionId, evidence_item: { company_id: tenant.companyId } },
      include: { evidence_item: true },
    });
    if (!version) {
      throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
    }
    return version;
  }

  private async loadCandidateControls(companyId: string): Promise<AiCandidateControl[]> {
    const companyControls = await this.prisma.companyControl.findMany({
      where: {
        company_framework: { company_id: companyId, status: 'ACTIVE' },
        control: { control_type: 'EVIDENCE_BASED' },
      },
      include: { control: { include: { evidence_requirements: true } } },
      orderBy: { control: { code: 'asc' } },
    });

    return companyControls.map((companyControl) => ({
      id: companyControl.control.id,
      code: companyControl.control.code,
      title: companyControl.control.title,
      riskLevel: companyControl.control.risk_level,
      requirements: companyControl.control.evidence_requirements.map((requirement) => ({
        id: requirement.id,
        code: requirement.code,
        name: requirement.name,
        required: requirement.required,
      })),
    }));
  }


  private async runProviderWithStructuredValidation(request: {
    promptVersion: string;
    prompt: string;
    untrustedDocumentText: string;
    fileName: string;
    mimeType: string;
    candidateControls: AiCandidateControl[];
  }) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const providerResponse = await this.provider.analyzeEvidence(request);
        const output = validateAiEvidenceAnalysisOutput(providerResponse.output);
        return { providerResponse, output, structuredRetryCount: attempt };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  private async createSuggestedMappings(params: {
    tenant: TenantContext;
    versionId: string;
    output: AiEvidenceAnalysisOutput;
    candidates: AiCandidateControl[];
  }) {
    let created = 0;
    const filtered = filterAiSuggestedMappings({ output: params.output, candidates: params.candidates });

    for (const acceptedSuggestion of filtered.accepted) {
      const requirementId = acceptedSuggestion.requirement?.id ?? null;

      const duplicate = requirementId
        ? await this.prisma.evidenceControlMapping.findFirst({
            where: {
              company_id: params.tenant.companyId,
              evidence_version_id: params.versionId,
              requirement_id: requirementId,
              status: { in: ['SUGGESTED', 'PENDING_REVIEW', 'APPROVED'] },
            },
          })
        : null;
      if (duplicate) continue;

      await this.prisma.evidenceControlMapping.create({
        data: {
          company_id: params.tenant.companyId,
          evidence_version_id: params.versionId,
          control_id: acceptedSuggestion.control.id,
          requirement_id: requirementId,
          source: 'AI_SUGGESTED',
          status: 'SUGGESTED',
          ai_confidence: toDecimalConfidence(acceptedSuggestion.suggestion.confidence),
          reason: acceptedSuggestion.suggestion.reason,
          mapped_by_user_id: null,
        },
      });
      created += 1;
    }
    return {
      created,
      ignoredUnknownControlCodeCount: filtered.ignoredUnknownControlCodeCount,
      ignoredUnknownRequirementCodeCount: filtered.ignoredUnknownRequirementCodeCount,
    };
  }
}
