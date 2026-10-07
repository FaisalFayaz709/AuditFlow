import { z } from 'zod';

export const AuditLogListQuerySchema = z.object({
  companyId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(80).optional(),
});

export type AuditLogListQuery = z.infer<typeof AuditLogListQuerySchema>;
