import type { AiEvidenceAnalysisOutput } from './ai-output.schema.js';

export type AiCandidateRequirement = {
  id: string;
  code: string;
  name: string;
  required: boolean;
};

export type AiCandidateControl = {
  id: string;
  code: string;
  title: string;
  riskLevel: string;
  requirements: AiCandidateRequirement[];
};

export type AiProviderRequest = {
  promptVersion: string;
  prompt: string;
  untrustedDocumentText: string;
  fileName: string;
  mimeType: string;
  candidateControls: AiCandidateControl[];
};

export type AiProviderResponse = {
  provider: string;
  modelName: string;
  output: AiEvidenceAnalysisOutput;
  tokenUsage?: Record<string, unknown>;
};

export type AiProvider = {
  analyzeEvidence(request: AiProviderRequest): Promise<AiProviderResponse>;
};

export type AiSettings = {
  enabled: boolean;
  allowRestrictedEvidence: boolean;
};
