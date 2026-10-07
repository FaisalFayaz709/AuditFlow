export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ControlType = 'EVIDENCE_BASED' | 'INFORMATIONAL';
export type ControlApplicability = 'APPLICABLE' | 'NOT_APPLICABLE';
export type EvidenceVersionStatus =
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'SECURITY_REJECTED'
  | 'PROCESSING'
  | 'PROCESSING_FAILED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'ARCHIVED';
export type MappingStatus = 'SUGGESTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type MappingSource = 'AI_SUGGESTED' | 'MANUAL';

export type EvidenceApprovalProvenance = {
  reviewId: string;
  reviewerUserId: string;
  reviewedAt: Date;
} | null;

export type MappingReviewProvenance = {
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
} | null;

export type ReadinessRequirementInput = {
  id: string;
  code: string;
  name: string;
  required: boolean;
};

export type ReadinessMappingInput = {
  id: string;
  requirementId: string | null;
  status: MappingStatus;
  source?: MappingSource;
  traceMetadata?: { storedConfidence?: number | null };
  mappedByUserId?: string | null;
  mappingReview?: MappingReviewProvenance;
  evidenceVersion: {
    id: string;
    status: EvidenceVersionStatus;
    expiryDate: Date | null;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
    evidenceItemArchivedAt: Date | null;
    approval?: EvidenceApprovalProvenance;
  };
};

export type ReadinessControlInput = {
  companyControlId: string;
  controlId: string;
  code: string;
  title: string;
  riskLevel: RiskLevel;
  controlType: ControlType;
  applicability: ControlApplicability;
  ownerUserId: string | null;
  requirements: ReadinessRequirementInput[];
  mappings: ReadinessMappingInput[];
};

export type RequirementCoverage = {
  id: string;
  code: string;
  name: string;
  required: boolean;
  satisfied: boolean;
  satisfyingEvidenceVersionIds: string[];
};

export type ControlCoverage = {
  companyControlId: string;
  controlId: string;
  code: string;
  title: string;
  riskLevel: RiskLevel;
  riskWeight: number;
  ownerUserId: string | null;
  requiredCount: number;
  satisfiedCount: number;
  coveragePercent: number;
  readinessState: 'READY' | 'IN_PROGRESS' | 'NOT_STARTED';
  requirements: RequirementCoverage[];
};

export type MissingRequirement = {
  companyControlId: string;
  controlId: string;
  controlCode: string;
  controlTitle: string;
  riskLevel: RiskLevel;
  ownerUserId: string | null;
  requirementId: string;
  requirementCode: string;
  requirementName: string;
};

export type ReadinessStatus = 'CALCULABLE' | 'NOT_CALCULABLE';

export type ReadinessResult = {
  readinessStatus: ReadinessStatus;
  readinessPercent: number | null;
  eligibleControls: number;
  readyControls: number;
  inProgressControls: number;
  notStartedControls: number;
  missingRequiredEvidence: number;
  controlCoverage: ControlCoverage[];
  missingRequirements: MissingRequirement[];
};

export const riskWeights: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function isEvidenceVersionCurrentlyValid(
  evidenceVersion: ReadinessMappingInput['evidenceVersion'],
  now: Date,
): boolean {
  if (evidenceVersion.status !== 'APPROVED') return false;
  if (evidenceVersion.evidenceItemArchivedAt) return false;
  if (evidenceVersion.expiryDate && evidenceVersion.expiryDate.getTime() < now.getTime()) return false;
  if (evidenceVersion.effectiveFrom && evidenceVersion.effectiveFrom.getTime() > now.getTime()) return false;
  if (evidenceVersion.effectiveUntil && evidenceVersion.effectiveUntil.getTime() < now.getTime()) return false;
  return true;
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateReadiness(params: { controls: ReadinessControlInput[]; now: Date }): ReadinessResult {
  const eligibleControls = params.controls.filter(
    (control) => control.applicability === 'APPLICABLE' && control.controlType === 'EVIDENCE_BASED',
  );

  if (eligibleControls.length === 0) {
    return {
      readinessStatus: 'NOT_CALCULABLE',
      readinessPercent: null,
      eligibleControls: 0,
      readyControls: 0,
      inProgressControls: 0,
      notStartedControls: 0,
      missingRequiredEvidence: 0,
      controlCoverage: [],
      missingRequirements: [],
    };
  }

  const controlCoverage = eligibleControls.map<ControlCoverage>((control) => {
    const requiredRequirements = control.requirements.filter((requirement) => requirement.required);
    const requirementCoverage = requiredRequirements.map<RequirementCoverage>((requirement) => {
      const satisfyingEvidenceVersionIds = [
        ...new Set(
          control.mappings
            .filter((mapping) => mapping.status === 'APPROVED')
            .filter((mapping) => mapping.requirementId === requirement.id)
            .filter((mapping) => isEvidenceVersionCurrentlyValid(mapping.evidenceVersion, params.now))
            .map((mapping) => mapping.evidenceVersion.id),
        ),
      ];

      return {
        id: requirement.id,
        code: requirement.code,
        name: requirement.name,
        required: requirement.required,
        satisfied: satisfyingEvidenceVersionIds.length > 0,
        satisfyingEvidenceVersionIds,
      };
    });

    const requiredCount = requiredRequirements.length;
    const satisfiedCount = requirementCoverage.filter((requirement) => requirement.satisfied).length;
    const coverageRatio = requiredCount === 0 ? 0 : satisfiedCount / requiredCount;
    const coveragePercent = roundOneDecimal(coverageRatio * 100);
    const readinessState =
      requiredCount > 0 && satisfiedCount === requiredCount ? 'READY' : satisfiedCount > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

    return {
      companyControlId: control.companyControlId,
      controlId: control.controlId,
      code: control.code,
      title: control.title,
      riskLevel: control.riskLevel,
      riskWeight: riskWeights[control.riskLevel],
      ownerUserId: control.ownerUserId,
      requiredCount,
      satisfiedCount,
      coveragePercent,
      readinessState,
      requirements: requirementCoverage,
    };
  });

  const denominator = controlCoverage.reduce((sum, control) => sum + control.riskWeight, 0);
  const numerator = controlCoverage.reduce(
    (sum, control) => sum + (control.requiredCount === 0 ? 0 : (control.satisfiedCount / control.requiredCount) * control.riskWeight),
    0,
  );

  const missingRequirements = controlCoverage.flatMap<MissingRequirement>((control) =>
    control.requirements
      .filter((requirement) => !requirement.satisfied)
      .map((requirement) => ({
        companyControlId: control.companyControlId,
        controlId: control.controlId,
        controlCode: control.code,
        controlTitle: control.title,
        riskLevel: control.riskLevel,
        ownerUserId: control.ownerUserId,
        requirementId: requirement.id,
        requirementCode: requirement.code,
        requirementName: requirement.name,
      })),
  );

  return {
    readinessStatus: 'CALCULABLE',
    readinessPercent: roundOneDecimal((100 * numerator) / denominator),
    eligibleControls: controlCoverage.length,
    readyControls: controlCoverage.filter((control) => control.readinessState === 'READY').length,
    inProgressControls: controlCoverage.filter((control) => control.readinessState === 'IN_PROGRESS').length,
    notStartedControls: controlCoverage.filter((control) => control.readinessState === 'NOT_STARTED').length,
    missingRequiredEvidence: missingRequirements.length,
    controlCoverage,
    missingRequirements,
  };
}
