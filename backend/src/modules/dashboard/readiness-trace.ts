import {
  isEvidenceVersionCurrentlyValid,
  riskWeights,
  type ControlApplicability,
  type ControlType,
  type EvidenceVersionStatus,
  type MappingSource,
  type MappingStatus,
  type ReadinessControlInput,
  type ReadinessStatus,
  type RiskLevel,
} from './readiness-calculator.js';

export type ReadinessTraceMappingEvaluation = {
  mappingId: string;
  mappingStatus: MappingStatus;
  mappingSource: MappingSource | 'UNKNOWN';
  approvedMapping: boolean;
  aiConfidenceUsed: false;
  aiConfidenceStored: number | null;
  mappedByUserId: string | null;
  mappingReviewedByUserId: string | null;
  mappingReviewedAt: string | null;
  evidenceVersionId: string;
  evidenceVersionStatus: EvidenceVersionStatus;
  evidenceApprovedByUserId: string | null;
  evidenceApprovedAt: string | null;
  evidenceReviewId: string | null;
  evidenceApprovalRecordPresent: boolean;
  evidenceCurrentlyValid: boolean;
  validityReasons: string[];
  countsTowardReadiness: boolean;
  auditEventHints: Array<'EVIDENCE_APPROVED' | 'MAPPING_APPROVED'>;
};

export type ReadinessTraceRequirement = {
  requirementId: string;
  requirementCode: string;
  requirementName: string;
  required: boolean;
  satisfied: boolean;
  advisoryGap: boolean;
  approvedMappingIds: string[];
  satisfyingEvidenceVersionIds: string[];
  mappingEvaluations: ReadinessTraceMappingEvaluation[];
  explanation: string;
};

export type ReadinessTraceControl = {
  companyControlId: string;
  controlId: string;
  controlCode: string;
  controlTitle: string;
  riskLevel: RiskLevel;
  riskWeight: number;
  controlType: ControlType;
  applicability: ControlApplicability;
  ownerUserId: string | null;
  eligibleForReadiness: boolean;
  exclusionReason: 'NONE' | 'NOT_APPLICABLE' | 'INFORMATIONAL';
  requiredCount: number;
  satisfiedCount: number;
  coveragePercent: number;
  readinessContribution: number;
  requirements: ReadinessTraceRequirement[];
  explanation: string;
};

export type ReadinessTraceResult = {
  calculatedAt: string;
  readinessStatus: ReadinessStatus;
  readinessPercent: number | null;
  traceScope: {
    eligibleRule: 'APPLICABLE_EVIDENCE_BASED_CONTROLS_ONLY';
    evidenceRule: 'APPROVED_VALID_EVIDENCE_WITH_APPROVED_MAPPING';
    aiConfidenceUsed: false;
    auditEventRule: 'EVIDENCE_APPROVED_AND_MAPPING_APPROVED_EVENTS_LINK_BUSINESS_STATE';
    traceIncludes: Array<'enrollment' | 'control' | 'requirement' | 'evidence_version' | 'evidence_review' | 'mapping_review' | 'validity' | 'audit_event_hints'>;
  };
  numerator: number;
  denominator: number;
  controls: ReadinessTraceControl[];
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function evaluateEvidenceValidity(mapping: ReadinessControlInput['mappings'][number], now: Date): string[] {
  const reasons: string[] = [];
  if (mapping.status !== 'APPROVED') reasons.push('MAPPING_NOT_APPROVED');
  if (mapping.evidenceVersion.status !== 'APPROVED') reasons.push('EVIDENCE_NOT_APPROVED');
  if (mapping.evidenceVersion.status === 'EXPIRED') reasons.push('EVIDENCE_EXPIRED_STATE');
  if (mapping.evidenceVersion.status === 'SUPERSEDED') reasons.push('EVIDENCE_SUPERSEDED');
  if (mapping.evidenceVersion.status === 'ARCHIVED') reasons.push('EVIDENCE_ARCHIVED_STATE');
  if (mapping.evidenceVersion.evidenceItemArchivedAt) reasons.push('EVIDENCE_ITEM_ARCHIVED');
  if (mapping.evidenceVersion.expiryDate && mapping.evidenceVersion.expiryDate.getTime() < now.getTime()) reasons.push('EVIDENCE_EXPIRED');
  if (mapping.evidenceVersion.effectiveFrom && mapping.evidenceVersion.effectiveFrom.getTime() > now.getTime()) reasons.push('EVIDENCE_NOT_YET_EFFECTIVE');
  if (mapping.evidenceVersion.effectiveUntil && mapping.evidenceVersion.effectiveUntil.getTime() < now.getTime()) reasons.push('EVIDENCE_VALIDITY_ENDED');
  if (reasons.length === 0) reasons.push('SATISFIES_REQUIREMENT');
  return reasons;
}

function explainRequirement(params: { required: boolean; satisfied: boolean; hasMappings: boolean; approvedMappingIds: string[] }): string {
  if (params.required && params.satisfied) return 'Required requirement is satisfied by at least one approved, current evidence version through an approved mapping.';
  if (params.required && !params.hasMappings) return 'Required requirement is missing because no mapping targets it.';
  if (params.required && params.approvedMappingIds.length === 0) return 'Required requirement is missing because available mappings are not approved.';
  if (params.required) return 'Required requirement is missing because mapped evidence is not currently valid and approved.';
  if (params.satisfied) return 'Optional requirement has approved supporting evidence; it is advisory and does not increase readiness.';
  return 'Optional requirement is unsatisfied but advisory; it does not reduce readiness.';
}

function explainControl(params: { eligible: boolean; exclusionReason: ReadinessTraceControl['exclusionReason']; requiredCount: number; satisfiedCount: number }): string {
  if (params.exclusionReason === 'NOT_APPLICABLE') return 'Control is excluded from readiness because company applicability is NOT_APPLICABLE.';
  if (params.exclusionReason === 'INFORMATIONAL') return 'Control is excluded from readiness because control_type is INFORMATIONAL.';
  if (params.requiredCount === 0) return 'Evidence-based applicable control has no required requirements; publication validation should prevent this state.';
  if (params.satisfiedCount === params.requiredCount) return 'Control is ready because every required evidence requirement is satisfied.';
  if (params.satisfiedCount > 0) return 'Control is in progress because some, but not all, required evidence requirements are satisfied.';
  return 'Control has not started because no required evidence requirements are satisfied.';
}

export function buildReadinessTrace(params: {
  controls: ReadinessControlInput[];
  readinessStatus: ReadinessStatus;
  readinessPercent: number | null;
  calculatedAt: Date;
}): ReadinessTraceResult {
  const controls = params.controls.map<ReadinessTraceControl>((control) => {
    const eligibleForReadiness = control.applicability === 'APPLICABLE' && control.controlType === 'EVIDENCE_BASED';
    const exclusionReason: ReadinessTraceControl['exclusionReason'] =
      control.applicability === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : control.controlType === 'INFORMATIONAL' ? 'INFORMATIONAL' : 'NONE';

    const requirements = control.requirements.map<ReadinessTraceRequirement>((requirement) => {
      const matchingMappings = control.mappings.filter((mapping) => mapping.requirementId === requirement.id);
      const mappingEvaluations = matchingMappings.map<ReadinessTraceMappingEvaluation>((mapping) => {
        const evidenceCurrentlyValid = isEvidenceVersionCurrentlyValid(mapping.evidenceVersion, params.calculatedAt);
        const validityReasons = evaluateEvidenceValidity(mapping, params.calculatedAt);
        return {
          mappingId: mapping.id,
          mappingStatus: mapping.status,
          mappingSource: mapping.source ?? 'UNKNOWN',
          approvedMapping: mapping.status === 'APPROVED',
          aiConfidenceUsed: false,
          aiConfidenceStored: mapping.traceMetadata?.storedConfidence ?? null,
          mappedByUserId: mapping.mappedByUserId ?? null,
          mappingReviewedByUserId: mapping.mappingReview?.reviewedByUserId ?? null,
          mappingReviewedAt: mapping.mappingReview?.reviewedAt?.toISOString() ?? null,
          evidenceVersionId: mapping.evidenceVersion.id,
          evidenceVersionStatus: mapping.evidenceVersion.status,
          evidenceApprovedByUserId: mapping.evidenceVersion.approval?.reviewerUserId ?? null,
          evidenceApprovedAt: mapping.evidenceVersion.approval?.reviewedAt.toISOString() ?? null,
          evidenceReviewId: mapping.evidenceVersion.approval?.reviewId ?? null,
          evidenceApprovalRecordPresent: Boolean(mapping.evidenceVersion.approval),
          evidenceCurrentlyValid,
          validityReasons,
          countsTowardReadiness: mapping.status === 'APPROVED' && evidenceCurrentlyValid,
          auditEventHints: mapping.status === 'APPROVED' && evidenceCurrentlyValid ? ['EVIDENCE_APPROVED', 'MAPPING_APPROVED'] : [],
        };
      });
      const satisfyingEvaluations = mappingEvaluations.filter((evaluation) => evaluation.countsTowardReadiness);
      const approvedMappingIds = unique(satisfyingEvaluations.map((evaluation) => evaluation.mappingId));
      const satisfyingEvidenceVersionIds = unique(satisfyingEvaluations.map((evaluation) => evaluation.evidenceVersionId));
      const satisfied = satisfyingEvidenceVersionIds.length > 0;
      return {
        requirementId: requirement.id,
        requirementCode: requirement.code,
        requirementName: requirement.name,
        required: requirement.required,
        satisfied,
        advisoryGap: !requirement.required && !satisfied,
        approvedMappingIds,
        satisfyingEvidenceVersionIds,
        mappingEvaluations,
        explanation: explainRequirement({ required: requirement.required, satisfied, hasMappings: matchingMappings.length > 0, approvedMappingIds }),
      };
    });

    const requiredRequirements = requirements.filter((requirement) => requirement.required);
    const requiredCount = requiredRequirements.length;
    const satisfiedCount = requiredRequirements.filter((requirement) => requirement.satisfied).length;
    const coveragePercent = requiredCount === 0 ? 0 : roundOneDecimal((satisfiedCount / requiredCount) * 100);
    const readinessContribution = eligibleForReadiness && requiredCount > 0 ? (satisfiedCount / requiredCount) * riskWeights[control.riskLevel] : 0;

    return {
      companyControlId: control.companyControlId,
      controlId: control.controlId,
      controlCode: control.code,
      controlTitle: control.title,
      riskLevel: control.riskLevel,
      riskWeight: riskWeights[control.riskLevel],
      controlType: control.controlType,
      applicability: control.applicability,
      ownerUserId: control.ownerUserId,
      eligibleForReadiness,
      exclusionReason,
      requiredCount,
      satisfiedCount,
      coveragePercent,
      readinessContribution: roundOneDecimal(readinessContribution),
      requirements,
      explanation: explainControl({ eligible: eligibleForReadiness, exclusionReason, requiredCount, satisfiedCount }),
    };
  });

  const eligibleControls = controls.filter((control) => control.eligibleForReadiness);
  const numerator = eligibleControls.reduce((sum, control) => sum + control.readinessContribution, 0);
  const denominator = eligibleControls.reduce((sum, control) => sum + control.riskWeight, 0);

  return {
    calculatedAt: params.calculatedAt.toISOString(),
    readinessStatus: params.readinessStatus,
    readinessPercent: params.readinessPercent,
    traceScope: {
      eligibleRule: 'APPLICABLE_EVIDENCE_BASED_CONTROLS_ONLY',
      evidenceRule: 'APPROVED_VALID_EVIDENCE_WITH_APPROVED_MAPPING',
      aiConfidenceUsed: false,
      auditEventRule: 'EVIDENCE_APPROVED_AND_MAPPING_APPROVED_EVENTS_LINK_BUSINESS_STATE',
      traceIncludes: ['enrollment', 'control', 'requirement', 'evidence_version', 'evidence_review', 'mapping_review', 'validity', 'audit_event_hints'],
    },
    numerator: roundOneDecimal(numerator),
    denominator,
    controls,
  };
}
