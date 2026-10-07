export type ProductionGateArea =
  | 'security'
  | 'files'
  | 'recovery'
  | 'observability'
  | 'privacy'
  | 'performance'
  | 'accessibility'
  | 'operations';

export type ProductionGateEvidenceStatus = 'PENDING_HUMAN_EVIDENCE' | 'APPROVED';

export interface ProductionGateEvidenceArea {
  area: ProductionGateArea;
  artifact: string;
  requiredEvidence: string[];
  status: ProductionGateEvidenceStatus;
}

export interface ProductionGateEvidenceManifest {
  schemaVersion: 'auditflow.productionGateEvidence.v1';
  gateStatus: ProductionGateEvidenceStatus;
  customerEvidenceAllowed: boolean;
  approvalRequiredBeforeCustomerEvidence: boolean;
  requiredAreas: ProductionGateEvidenceArea[];
}

export const PRODUCTION_GATE_REQUIRED_AREAS: ProductionGateArea[] = [
  'security',
  'files',
  'recovery',
  'observability',
  'privacy',
  'performance',
  'accessibility',
  'operations',
];

export const PRODUCTION_GATE_REQUIRED_RUNBOOKS = [
  'suspected cross-tenant access',
  'malware upload',
  'database outage',
  'object storage outage',
  'AI provider outage',
  'worker/Redis outage',
  'credential leak',
  'failed migration',
] as const;

export function collectProductionGateEvidenceFailures(manifest: ProductionGateEvidenceManifest): string[] {
  const failures: string[] = [];

  if (manifest.schemaVersion !== 'auditflow.productionGateEvidence.v1') {
    failures.push('production gate evidence manifest schemaVersion must be auditflow.productionGateEvidence.v1');
  }

  if (!manifest.approvalRequiredBeforeCustomerEvidence) {
    failures.push('approvalRequiredBeforeCustomerEvidence must remain true');
  }

  const seen = new Set(manifest.requiredAreas.map((entry) => entry.area));
  for (const area of PRODUCTION_GATE_REQUIRED_AREAS) {
    if (!seen.has(area)) failures.push(`missing production gate area: ${area}`);
  }

  for (const area of manifest.requiredAreas) {
    if (!area.artifact?.startsWith('docs/production-gates/')) {
      failures.push(`${area.area} artifact must live under docs/production-gates/`);
    }
    if (!Array.isArray(area.requiredEvidence) || area.requiredEvidence.length === 0) {
      failures.push(`${area.area} must list required evidence`);
    }
  }

  if (manifest.customerEvidenceAllowed && manifest.gateStatus !== 'APPROVED') {
    failures.push('customerEvidenceAllowed cannot be true unless gateStatus is APPROVED');
  }

  if (manifest.gateStatus === 'APPROVED') {
    for (const area of manifest.requiredAreas) {
      if (area.status !== 'APPROVED') failures.push(`${area.area} must be APPROVED before gateStatus can be APPROVED`);
    }
  }

  return failures;
}
