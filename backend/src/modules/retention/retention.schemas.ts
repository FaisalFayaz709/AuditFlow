import { z } from 'zod';

export const deletionEntityTypes = ['EVIDENCE_ITEM', 'REPORT', 'AI_ANALYSIS'] as const;
export type DeletionEntityType = (typeof deletionEntityTypes)[number];

export const DeletionRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  entityType: z.enum(deletionEntityTypes).optional(),
});
export type DeletionRequestListQuery = z.infer<typeof DeletionRequestListQuerySchema>;

export const CreateDeletionRequestBodySchema = z.object({
  entityType: z.enum(deletionEntityTypes),
  entityId: z.string().min(1),
  reason: z.string().min(10).max(2000),
  backupLimitationAcknowledged: z.literal(true),
});
export type CreateDeletionRequestBody = z.infer<typeof CreateDeletionRequestBodySchema>;

export const DeletionRequestIdParamsSchema = z.object({
  deletionRequestId: z.string().min(1),
});

export const ApproveDeletionRequestBodySchema = z.object({
  executeAfter: z.string().datetime().optional(),
});
export type ApproveDeletionRequestBody = z.infer<typeof ApproveDeletionRequestBodySchema>;

export const CancelDeletionRequestBodySchema = z.object({
  reason: z.string().min(3).max(1000).optional(),
});
export type CancelDeletionRequestBody = z.infer<typeof CancelDeletionRequestBodySchema>;

export const LegalHoldListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includeReleased: z.coerce.boolean().default(false),
});
export type LegalHoldListQuery = z.infer<typeof LegalHoldListQuerySchema>;

export const CreateLegalHoldBodySchema = z.object({
  entityType: z.enum(deletionEntityTypes).optional(),
  entityId: z.string().min(1).optional(),
  reason: z.string().min(10).max(2000),
}).refine((value) => (value.entityType && value.entityId) || (!value.entityType && !value.entityId), {
  message: 'entityType and entityId must be supplied together, or both omitted for a company-wide legal hold.',
  path: ['entityId'],
});
export type CreateLegalHoldBody = z.infer<typeof CreateLegalHoldBodySchema>;

export const LegalHoldIdParamsSchema = z.object({
  legalHoldId: z.string().min(1),
});
