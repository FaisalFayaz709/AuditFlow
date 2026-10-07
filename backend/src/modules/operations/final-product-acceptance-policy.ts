export const PASS_60_FINAL_PRODUCT_ACCEPTANCE_VERSION = 'final-locked-spec-product-acceptance-v1.0-pass-60' as const;

export const PASS_60_CUSTOMER_EVIDENCE_BLOCKED = 'BLOCKED_UNTIL_PASS_59_STRICT_APPROVAL_AND_PASS_60_RUNTIME_ACCEPTANCE' as const;

export const PASS_60_REQUIRED_ACCEPTANCE_GATES = [
  'frozen_pnpm_install',
  'full_ci_pipeline',
  'database_migration_runtime',
  'openapi_contract_generation',
  'backend_frontend_builds',
  'security_acceptance_suite',
  'ai_evaluation_gate',
  'strict_production_nonfunctional_gate',
  'deployed_critical_workflow_smoke',
  'readiness_trace_verification',
  'release_audit_record',
] as const;

export type Pass60AcceptanceGate = (typeof PASS_60_REQUIRED_ACCEPTANCE_GATES)[number];

export type Pass60EvidenceStatus = 'PENDING_RUNTIME_EVIDENCE' | 'APPROVED' | 'REJECTED';

export type Pass60AcceptanceEvidence = {
  gate: Pass60AcceptanceGate;
  status: Pass60EvidenceStatus;
  commandOrEvidence: readonly string[];
  evidenceReferences?: readonly string[];
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export const PASS_60_MANUAL_ACCEPTANCE_SCENARIO = [
  'register_owner',
  'create_company',
  'enable_starter_framework',
  'assign_control_owner',
  'create_evidence_task',
  'upload_evidence',
  'validate_file_security_state',
  'approve_evidence',
  'create_manual_mapping',
  'approve_mapping',
  'recalculate_readiness',
  'generate_readiness_report',
  'grant_auditor_access',
  'confirm_auditor_read_only_access',
  'confirm_audit_log_trace',
  'confirm_readiness_trace_explains_percentage',
] as const;

export const PASS_60_REQUIRED_READINESS_TRACE_FIELDS = [
  'company_framework_enrollment',
  'applicable_evidence_based_control',
  'evidence_requirement',
  'immutable_evidence_version',
  'evidence_review_approval',
  'mapping_review_approval',
  'validity_and_expiry_decision',
  'supersession_or_archival_state',
  'audit_event_provenance',
] as const;

export type Pass60ManualScenarioStep = (typeof PASS_60_MANUAL_ACCEPTANCE_SCENARIO)[number];
export type Pass60ReadinessTraceField = (typeof PASS_60_REQUIRED_READINESS_TRACE_FIELDS)[number];

export type Pass60FinalAcceptanceSnapshot = {
  pass: 60;
  version: typeof PASS_60_FINAL_PRODUCT_ACCEPTANCE_VERSION;
  status: Pass60EvidenceStatus;
  customerEvidenceAllowed: boolean;
  productionGateStatus: 'PENDING_HUMAN_EVIDENCE' | 'APPROVED' | 'REJECTED';
  customerEvidenceRelease: typeof PASS_60_CUSTOMER_EVIDENCE_BLOCKED | 'APPROVED_FOR_CUSTOMER_EVIDENCE';
  approvalReference?: string | null;
  requiredGates: readonly Pass60AcceptanceEvidence[];
  manualScenarioSteps: readonly Pass60ManualScenarioStep[];
  readinessTraceFields: readonly Pass60ReadinessTraceField[];
};

function missingFrom<T extends string>(required: readonly T[], provided: readonly string[]): T[] {
  const providedSet = new Set(provided);
  return required.filter((item) => !providedSet.has(item));
}

function looksPlaceholder(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim().toLowerCase();
  return text.length === 0 || text === 'todo' || text === 'tbd' || text === 'pending' || text.includes('placeholder');
}

export function assertPass60RequiredGateCoverage(gates: readonly Pass60AcceptanceEvidence[]): void {
  const gateNames = gates.map((entry) => entry.gate);
  const missing = missingFrom(PASS_60_REQUIRED_ACCEPTANCE_GATES, gateNames);
  if (missing.length > 0) {
    throw new Error(`Pass 60 final acceptance missing gates: ${missing.join(', ')}`);
  }

  for (const gate of gates) {
    if (!PASS_60_REQUIRED_ACCEPTANCE_GATES.includes(gate.gate)) {
      throw new Error(`Pass 60 final acceptance has unknown gate: ${gate.gate}`);
    }
    if (!gate.commandOrEvidence.length) {
      throw new Error(`Pass 60 final acceptance gate ${gate.gate} must include command/evidence expectations.`);
    }
  }
}

export function assertPass60ManualScenarioCoverage(steps: readonly Pass60ManualScenarioStep[]): void {
  const missing = missingFrom(PASS_60_MANUAL_ACCEPTANCE_SCENARIO, steps);
  if (missing.length > 0) {
    throw new Error(`Pass 60 manual acceptance scenario missing steps: ${missing.join(', ')}`);
  }
}

export function assertPass60ReadinessTraceCoverage(fields: readonly Pass60ReadinessTraceField[]): void {
  const missing = missingFrom(PASS_60_REQUIRED_READINESS_TRACE_FIELDS, fields);
  if (missing.length > 0) {
    throw new Error(`Pass 60 readiness trace acceptance missing fields: ${missing.join(', ')}`);
  }
}

export function assertPass60NoFinalAcceptanceWithoutStrictEvidence(snapshot: Pass60FinalAcceptanceSnapshot): void {
  if (snapshot.customerEvidenceAllowed === true && snapshot.productionGateStatus !== 'APPROVED') {
    throw new Error('Pass 60 forbids customer evidence before Pass 59 strict production gate is approved.');
  }
  if (snapshot.customerEvidenceAllowed === true && snapshot.status !== 'APPROVED') {
    throw new Error('Pass 60 forbids customer evidence before final product acceptance is approved.');
  }
  if (snapshot.customerEvidenceAllowed === true && looksPlaceholder(snapshot.approvalReference)) {
    throw new Error('Pass 60 requires a non-placeholder final acceptance approval reference before customer evidence is enabled.');
  }
}

export function assertPass60FinalAcceptanceReady(snapshot: Pass60FinalAcceptanceSnapshot): void {
  assertPass60RequiredGateCoverage(snapshot.requiredGates);
  assertPass60ManualScenarioCoverage(snapshot.manualScenarioSteps);
  assertPass60ReadinessTraceCoverage(snapshot.readinessTraceFields);
  assertPass60NoFinalAcceptanceWithoutStrictEvidence(snapshot);

  if (snapshot.status !== 'APPROVED') {
    throw new Error('Pass 60 final product acceptance is not approved.');
  }
  if (snapshot.productionGateStatus !== 'APPROVED') {
    throw new Error('Pass 60 final product acceptance requires Pass 59 strict production gate approval.');
  }
  if (snapshot.customerEvidenceAllowed !== true || snapshot.customerEvidenceRelease !== 'APPROVED_FOR_CUSTOMER_EVIDENCE') {
    throw new Error('Pass 60 approved acceptance must explicitly approve customer evidence release.');
  }
  if (looksPlaceholder(snapshot.approvalReference)) {
    throw new Error('Pass 60 final product acceptance requires a real approval reference.');
  }

  for (const gate of snapshot.requiredGates) {
    if (gate.status !== 'APPROVED') {
      throw new Error(`Pass 60 final acceptance gate is not approved: ${gate.gate}`);
    }
    if (looksPlaceholder(gate.approvedBy) || looksPlaceholder(gate.approvedAt)) {
      throw new Error(`Pass 60 final acceptance gate ${gate.gate} requires approvedBy and approvedAt.`);
    }
    if (!gate.evidenceReferences || gate.evidenceReferences.length === 0 || gate.evidenceReferences.some(looksPlaceholder)) {
      throw new Error(`Pass 60 final acceptance gate ${gate.gate} requires non-placeholder evidence references.`);
    }
  }
}

export function buildPass60BlockedFinalAcceptanceSnapshot(): Pass60FinalAcceptanceSnapshot {
  return {
    pass: 60,
    version: PASS_60_FINAL_PRODUCT_ACCEPTANCE_VERSION,
    status: 'PENDING_RUNTIME_EVIDENCE',
    customerEvidenceAllowed: false,
    productionGateStatus: 'PENDING_HUMAN_EVIDENCE',
    customerEvidenceRelease: PASS_60_CUSTOMER_EVIDENCE_BLOCKED,
    approvalReference: null,
    requiredGates: PASS_60_REQUIRED_ACCEPTANCE_GATES.map((gate) => ({
      gate,
      status: 'PENDING_RUNTIME_EVIDENCE',
      commandOrEvidence: [
        'run in local/CI environment with pnpm@9.12.0, PostgreSQL, object storage, and required production evidence',
      ],
      evidenceReferences: [],
      approvedBy: null,
      approvedAt: null,
    })),
    manualScenarioSteps: PASS_60_MANUAL_ACCEPTANCE_SCENARIO,
    readinessTraceFields: PASS_60_REQUIRED_READINESS_TRACE_FIELDS,
  };
}

export function assertPass60FinalAcceptanceContract(): void {
  const blocked = buildPass60BlockedFinalAcceptanceSnapshot();
  assertPass60RequiredGateCoverage(blocked.requiredGates);
  assertPass60ManualScenarioCoverage(blocked.manualScenarioSteps);
  assertPass60ReadinessTraceCoverage(blocked.readinessTraceFields);
  assertPass60NoFinalAcceptanceWithoutStrictEvidence(blocked);
  try {
    assertPass60FinalAcceptanceReady(blocked);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not approved')) return;
    throw error;
  }
  throw new Error('Pass 60 blocked final acceptance snapshot unexpectedly passed final approval.');
}
