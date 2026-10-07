import type { AiEvidenceAnalysisOutput } from '../ai-output.schema.js';
import type { AiCandidateControl } from '../ai.types.js';

export type AiEvaluationEvidenceClass =
  | 'policy'
  | 'access_review'
  | 'log'
  | 'screenshot'
  | 'malformed'
  | 'irrelevant'
  | 'prompt_injection';

export type AiEvaluationCase = {
  id: string;
  title: string;
  evidenceClass: AiEvaluationEvidenceClass;
  fileName: string;
  mimeType: string;
  untrustedDocumentText: string;
  candidateControls: AiCandidateControl[];
  expectedDocumentType?: AiEvidenceAnalysisOutput['documentType'];
  expectedSuggestedControlCodes?: string[];
  promptInjection?: boolean;
  irrelevant?: boolean;
};

export type AiEvaluationMetrics = {
  corpusVersion: string;
  promptVersion: string;
  modelName: string;
  provider: string;
  totalCases: number;
  structuredJsonValidity: number;
  unknownControlCodeHandling: number;
  autoApprovalStateChanges: number;
  promptInjectionBypassCount: number;
  mappingPrecision: number;
  hallucinatedAcceptedFacts: number;
  providerFailureManualWorkflowPreserved: number;
};

export type AiEvaluationResult = {
  passed: boolean;
  metrics: AiEvaluationMetrics;
  failures: string[];
};
