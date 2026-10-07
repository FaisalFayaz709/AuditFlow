import { z } from 'zod';

export const EvidenceVersionAiParamsSchema = z.object({
  versionId: z.string().min(1),
});

export const AiSettingsBodySchema = z.object({
  enabled: z.boolean(),
  allowRestrictedEvidence: z.boolean().default(false),
});

export type AiSettingsBody = z.infer<typeof AiSettingsBodySchema>;
