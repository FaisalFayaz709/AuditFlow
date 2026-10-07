import type { AiEvidenceAnalysisOutput, AiSuggestedMapping } from './ai-output.schema.js';
import type { AiCandidateControl, AiCandidateRequirement } from './ai.types.js';

export type AcceptedAiSuggestion = {
  suggestion: AiSuggestedMapping;
  control: AiCandidateControl;
  requirement: AiCandidateRequirement | undefined;
};

export type AiSuggestionFilteringResult = {
  accepted: AcceptedAiSuggestion[];
  ignoredUnknownControlCodeCount: number;
  ignoredUnknownRequirementCodeCount: number;
};

export function filterAiSuggestedMappings(params: {
  output: AiEvidenceAnalysisOutput;
  candidates: AiCandidateControl[];
}): AiSuggestionFilteringResult {
  const accepted: AcceptedAiSuggestion[] = [];
  let ignoredUnknownControlCodeCount = 0;
  let ignoredUnknownRequirementCodeCount = 0;
  const candidateByCode = new Map(params.candidates.map((candidate) => [candidate.code, candidate]));

  for (const suggestion of params.output.suggestedMappings) {
    const control = candidateByCode.get(suggestion.controlCode);
    if (!control) {
      ignoredUnknownControlCodeCount += 1;
      continue;
    }

    const requirement = suggestion.requirementCode ? control.requirements.find((item) => item.code === suggestion.requirementCode) : undefined;
    if (suggestion.requirementCode && !requirement) {
      ignoredUnknownRequirementCodeCount += 1;
      continue;
    }

    accepted.push({ suggestion, control, requirement });
  }

  return { accepted, ignoredUnknownControlCodeCount, ignoredUnknownRequirementCodeCount };
}

export const PASS_53_AI_SUGGESTION_STATE_RULE = {
  source: 'AI_SUGGESTED',
  status: 'SUGGESTED',
  readinessContribution: 'NONE_UNTIL_HUMAN_APPROVES_MAPPING_AND_EVIDENCE',
} as const;
