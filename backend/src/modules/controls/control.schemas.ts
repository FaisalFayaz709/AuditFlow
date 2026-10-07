import { z } from 'zod';

export const ControlsQuerySchema = z.object({
  companyFrameworkId: z.string().min(1).optional(),
  status: z.enum(['APPLICABLE', 'NOT_APPLICABLE']).optional(),
  ownerUserId: z.string().min(1).optional(),
  riskLevel: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  controlType: z.enum(['EVIDENCE_BASED', 'INFORMATIONAL']).optional(),
});

export const ControlIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const CompanyControlStateBodySchema = z.object({
  applicability: z.enum(['APPLICABLE', 'NOT_APPLICABLE']).optional(),
  notApplicableReason: z.string().trim().min(1).max(1000).nullable().optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one company-control state field is required.',
}).superRefine((value, ctx) => {
  if (value.applicability === 'NOT_APPLICABLE' && !value.notApplicableReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['notApplicableReason'],
      message: 'A reason is required when a control is marked NOT_APPLICABLE.',
    });
  }
});

export type ControlsQuery = z.infer<typeof ControlsQuerySchema>;
export type CompanyControlStateBody = z.infer<typeof CompanyControlStateBodySchema>;
