import { AiEvidenceAnalysisOutputSchema, type AiEvidenceAnalysisOutput } from './ai-output.schema.js';
import type { AiCandidateControl, AiProvider, AiProviderRequest, AiProviderResponse } from './ai.types.js';

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function findCandidate(candidates: AiCandidateControl[], controlCodes: string[]) {
  return candidates.find((candidate) => controlCodes.includes(candidate.code));
}

function firstRequiredRequirement(control: AiCandidateControl | undefined, preferredCodes: string[] = []) {
  if (!control) return undefined;
  return control.requirements.find((requirement) => preferredCodes.includes(requirement.code)) ?? control.requirements.find((requirement) => requirement.required) ?? control.requirements[0];
}

export class MockAiProvider implements AiProvider {
  constructor(private readonly modelName = 'auditflow-mock-v1') {}

  async analyzeEvidence(request: AiProviderRequest): Promise<AiProviderResponse> {
    const text = `${request.fileName}\n${request.untrustedDocumentText}`.toLowerCase();
    let documentType: AiEvidenceAnalysisOutput['documentType'] = 'OTHER';
    const suggestedMappings: AiEvidenceAnalysisOutput['suggestedMappings'] = [];
    const missingInformation = new Set<string>();

    const addMapping = (controlCodes: string[], requirementCodes: string[], confidence: number, reason: string) => {
      const control = findCandidate(request.candidateControls, controlCodes);
      const requirement = firstRequiredRequirement(control, requirementCodes);
      if (!control || !requirement) return;
      suggestedMappings.push({
        controlCode: control.code,
        requirementCode: requirement.code,
        confidence,
        reason,
      });
    };

    if (includesAny(text, ['access review', 'user access review', 'quarterly access'])) {
      documentType = 'ACCESS_REVIEW';
      addMapping(['AC-002'], ['AC-002-REQ-1'], 0.86, 'The text appears to describe a user access review.');
      if (!includesAny(text, ['approved', 'approval', 'reviewed by'])) missingInformation.add('approval_evidence');
      if (!includesAny(text, ['quarter', 'q1', 'q2', 'q3', 'q4', 'period'])) missingInformation.add('review_period');
    } else if (includesAny(text, ['user list', 'authorized users', 'current users'])) {
      documentType = 'ACCESS_REVIEW';
      addMapping(['AC-001'], ['AC-001-REQ-1'], 0.78, 'The text appears to identify current or authorized users.');
    } else if (includesAny(text, ['training', 'awareness', 'completion report'])) {
      documentType = 'TRAINING_REPORT';
      addMapping(['TR-001'], ['TR-001-REQ-1'], 0.82, 'The text appears to describe security awareness training completion.');
    } else if (includesAny(text, ['backup', 'restore', 'restoration'])) {
      documentType = 'BACKUP_LOG';
      addMapping(['BM-001', 'BM-002'], ['BM-001-REQ-1', 'BM-002-REQ-1'], 0.8, 'The text appears to describe backup or restoration activity.');
    } else if (includesAny(text, ['incident', 'postmortem', 'root cause'])) {
      documentType = 'INCIDENT_RECORD';
      addMapping(['IM-001'], ['IM-001-REQ-1'], 0.81, 'The text appears to describe incident tracking or resolution.');
    } else if (includesAny(text, ['vendor', 'supplier', 'questionnaire'])) {
      documentType = 'VENDOR_QUESTIONNAIRE';
      addMapping(['VM-001'], ['VM-001-REQ-1'], 0.77, 'The text appears to describe vendor review evidence.');
    } else if (includesAny(text, ['policy', 'procedure', 'approved policy'])) {
      documentType = 'POLICY';
      addMapping(['PM-001', 'PM-002'], ['PM-001-REQ-1', 'PM-002-REQ-1'], 0.79, 'The text appears to describe a security policy or policy review.');
      if (!includesAny(text, ['approved', 'approval'])) missingInformation.add('approval_record');
    }

    if (!includesAny(text, ['date', '202', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])) {
      missingInformation.add('evidence_date');
    }

    const summary = request.untrustedDocumentText.length > 0
      ? `Advisory summary based on bounded extracted text from ${request.fileName}. Human review is required before using this evidence.`
      : `Advisory metadata-only summary for ${request.fileName}. No supported text extractor was available.`;

    const output = AiEvidenceAnalysisOutputSchema.parse({
      documentType,
      summary,
      suggestedMappings,
      missingInformation: [...missingInformation],
      duplicateHints: [],
    });

    return {
      provider: 'mock',
      modelName: this.modelName,
      output,
      tokenUsage: {
        approximateInputCharacters: request.prompt.length,
        approximateOutputCharacters: JSON.stringify(output).length,
      },
    };
  }
}
