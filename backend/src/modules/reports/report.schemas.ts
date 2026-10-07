import { z } from 'zod';

export const ReportTypeSchema = z.enum(['AUDIT_READINESS', 'MISSING_EVIDENCE', 'CONTROL_COVERAGE', 'EVIDENCE_INVENTORY']);
export const ReportFormatSchema = z.enum(['JSON', 'CSV']);
export const ReportStatusSchema = z.enum(['QUEUED', 'GENERATING', 'COMPLETED', 'FAILED', 'EXPIRED']);

export const GenerateReportBodySchema = z.object({
  type: ReportTypeSchema,
  format: ReportFormatSchema.default('JSON'),
  companyFrameworkId: z.string().min(1).optional(),
  expiringDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const ReportListQuerySchema = z.object({
  type: ReportTypeSchema.optional(),
  status: ReportStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const ReportIdParamsSchema = z.object({ id: z.string().min(1) });

export type GenerateReportBody = z.infer<typeof GenerateReportBodySchema>;
export type ReportListQuery = z.infer<typeof ReportListQuerySchema>;
export type ReportType = z.infer<typeof ReportTypeSchema>;
export type ReportFormat = z.infer<typeof ReportFormatSchema>;
