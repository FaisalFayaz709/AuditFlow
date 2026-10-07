import { z } from 'zod';

export const AuditorScopeTypeSchema = z.enum(['FRAMEWORK', 'CONTROL', 'EVIDENCE_ITEM', 'EVIDENCE_VERSION', 'REPORT']);

export const AuditorGrantIdParamsSchema = z.object({ grantId: z.string().min(1) });

export const AuditorAccessListQuerySchema = z.object({
  auditorMemberId: z.string().min(1).optional(),
  scopeType: AuditorScopeTypeSchema.optional(),
  includeRevoked: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});


export const AuditorViewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const CreateAuditorAccessGrantBodySchema = z.object({
  auditorMemberId: z.string().min(1),
  scopeType: AuditorScopeTypeSchema,
  scopeId: z.string().min(1),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
  downloadAllowed: z.boolean().default(true),
});

export type AuditorScopeTypeValue = z.infer<typeof AuditorScopeTypeSchema>;
export type AuditorAccessListQuery = z.infer<typeof AuditorAccessListQuerySchema>;
export type AuditorViewListQuery = z.infer<typeof AuditorViewListQuerySchema>;
export type CreateAuditorAccessGrantBody = z.infer<typeof CreateAuditorAccessGrantBodySchema>;
