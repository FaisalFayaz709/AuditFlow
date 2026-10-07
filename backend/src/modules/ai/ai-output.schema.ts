import { z } from 'zod';

export const AiDocumentTypeSchema = z.enum([
  'POLICY',
  'ACCESS_REVIEW',
  'TRAINING_REPORT',
  'BACKUP_LOG',
  'INCIDENT_RECORD',
  'VENDOR_QUESTIONNAIRE',
  'OTHER',
]);

export const AiSuggestedMappingSchema = z.object({
  controlCode: z.string().min(1).max(64),
  requirementCode: z.string().min(1).max(64).optional(),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(1000),
});

export const AiEvidenceAnalysisOutputSchema = z.object({
  documentType: AiDocumentTypeSchema,
  summary: z.string().min(1).max(4000),
  suggestedMappings: z.array(AiSuggestedMappingSchema).max(10).default([]),
  missingInformation: z.array(z.string().min(1).max(128)).max(20).default([]),
  duplicateHints: z.array(z.string().min(1).max(256)).max(20).default([]),
});

export type AiEvidenceAnalysisOutput = z.infer<typeof AiEvidenceAnalysisOutputSchema>;
export type AiSuggestedMapping = z.infer<typeof AiSuggestedMappingSchema>;
