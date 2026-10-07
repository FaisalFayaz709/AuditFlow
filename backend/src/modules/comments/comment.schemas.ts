import { z } from 'zod';

export const CommentEntityTypeSchema = z.enum(['TASK', 'COMPANY_CONTROL', 'EVIDENCE_ITEM', 'EVIDENCE_VERSION']);
export const CommentVisibilitySchema = z.enum(['INTERNAL', 'AUDITOR_VISIBLE']);

export const CommentIdParamsSchema = z.object({ id: z.string().min(1) });

export const CommentListQuerySchema = z.object({
  entityType: CommentEntityTypeSchema,
  entityId: z.string().min(1),
  includeArchived: z.coerce.boolean().default(false),
});

export const CreateCommentBodySchema = z.object({
  entityType: CommentEntityTypeSchema,
  entityId: z.string().min(1),
  visibility: CommentVisibilitySchema.default('INTERNAL'),
  body: z.string().trim().min(1).max(4000),
});

export const UpdateCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type CommentEntityType = z.infer<typeof CommentEntityTypeSchema>;
export type CommentListQuery = z.infer<typeof CommentListQuerySchema>;
export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;
export type UpdateCommentBody = z.infer<typeof UpdateCommentBodySchema>;
