import { z } from 'zod';

export const DashboardQuerySchema = z.object({
  companyFrameworkId: z.string().min(1).optional(),
  expiringDays: z.coerce.number().int().min(1).max(365).default(30),
});

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
