import { z } from 'zod';

export const EvidenceSensitivityLevelSchema = z.enum(['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
export const EvidenceVersionStatusSchema = z.enum([
  'UPLOADED',
  'QUARANTINED',
  'SECURITY_REJECTED',
  'PROCESSING',
  'PROCESSING_FAILED',
  'NEEDS_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUPERSEDED',
  'ARCHIVED',
]);

export const EvidenceListQuerySchema = z.object({
  status: EvidenceVersionStatusSchema.optional(),
  sensitivityLevel: EvidenceSensitivityLevelSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  includeArchived: z.coerce.boolean().default(false),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const EvidenceIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const EvidenceVersionIdParamsSchema = z.object({
  versionId: z.string().min(1),
});

export const UploadMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  sensitivityLevel: EvidenceSensitivityLevelSchema.default('INTERNAL'),
});

export type EvidenceListQuery = z.infer<typeof EvidenceListQuerySchema>;
export type UploadMetadata = z.infer<typeof UploadMetadataSchema>;


export const EvidenceApproveBodySchema = z.object({
  reviewNote: z.string().trim().max(2000).optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const EvidenceRejectBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  reviewNote: z.string().trim().max(2000).optional(),
});

export const EvidenceArchiveBodySchema = z.object({
  reason: z.string().trim().max(2000).optional(),
}).default({});

export type EvidenceApproveBody = z.infer<typeof EvidenceApproveBodySchema>;
export type EvidenceRejectBody = z.infer<typeof EvidenceRejectBodySchema>;
export type EvidenceArchiveBody = z.infer<typeof EvidenceArchiveBodySchema>;
