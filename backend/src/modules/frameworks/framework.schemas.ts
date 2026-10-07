import { z } from 'zod';

export const FrameworkIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const FrameworkEnableParamsSchema = z.object({
  companyId: z.string().min(1),
  frameworkVersionId: z.string().min(1),
});

export const FrameworkEnableBodySchema = z.object({
  targetAuditDate: z.string().datetime().nullable().optional(),
});

export type FrameworkEnableBody = z.infer<typeof FrameworkEnableBodySchema>;

export const FrameworkUpgradePreviewParamsSchema = z.object({
  enrollmentId: z.string().min(1),
});

export const FrameworkUpgradePreviewBodySchema = z.object({
  targetFrameworkVersionId: z.string().min(1),
});

export type FrameworkUpgradePreviewBody = z.infer<typeof FrameworkUpgradePreviewBodySchema>;

export const FrameworkUpgradeDraftParamsSchema = z.object({
  draftEnrollmentId: z.string().min(1),
});

export const FrameworkUpgradeActivateBodySchema = z.object({
  reviewedProposedValues: z.boolean(),
  migrateOpenTasks: z.boolean().optional().default(false),
  activationNote: z.string().max(2000).optional(),
});

export type FrameworkUpgradeActivateBody = z.infer<typeof FrameworkUpgradeActivateBodySchema>;

export const controlTypes = ['EVIDENCE_BASED', 'INFORMATIONAL'] as const;
export const controlRiskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const companyFrameworkStatuses = ['DRAFT_RECONCILIATION', 'ACTIVE', 'ENDED'] as const;
export const frameworkVersionStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export const frameworkUpgradeMatchTypes = ['MATCHED', 'ADDED', 'REMOVED', 'MATERIALLY_CHANGED'] as const;
export const frameworkUpgradeReconciliationStatuses = ['OPEN', 'REVIEWED', 'ACTIVATED', 'CANCELLED'] as const;
export const frameworkUpgradeMappingCandidateStatuses = ['PENDING_REVIEW_READY', 'COPIED_PENDING_REVIEW', 'SKIPPED'] as const;
