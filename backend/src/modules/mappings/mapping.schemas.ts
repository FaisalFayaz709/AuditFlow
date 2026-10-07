import { z } from 'zod';

export const MappingIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const EvidenceVersionMappingParamsSchema = z.object({
  versionId: z.string().min(1),
});

export const MappingStatusSchema = z.enum(['SUGGESTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']);
export const MappingSourceSchema = z.enum(['AI_SUGGESTED', 'MANUAL']);

export const CreateManualMappingBodySchema = z.object({
  controlId: z.string().min(1),
  requirementId: z.string().min(1),
  reason: z.string().trim().max(2000).optional(),
});

export const ApproveMappingBodySchema = z.object({
  reviewNote: z.string().trim().max(2000).optional(),
}).default({});

export const RejectMappingBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  reviewNote: z.string().trim().max(2000).optional(),
});

export const MappingListQuerySchema = z.object({
  status: MappingStatusSchema.optional(),
  source: MappingSourceSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export type CreateManualMappingBody = z.infer<typeof CreateManualMappingBodySchema>;
export type ApproveMappingBody = z.infer<typeof ApproveMappingBodySchema>;
export type RejectMappingBody = z.infer<typeof RejectMappingBodySchema>;
export type MappingListQuery = z.infer<typeof MappingListQuerySchema>;
