export const PASS_59_PRODUCTION_GATE_VERSION = 'production-nonfunctional-evidence-gate-v1.0-pass-59' as const;

export const PASS_59_CUSTOMER_EVIDENCE_BLOCKED = 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_APPROVAL' as const;

export const PASS_59_REQUIRED_PRODUCTION_AREAS = [
  'security',
  'files',
  'recovery',
  'observability',
  'privacy',
  'performance',
  'accessibility',
  'operations',
] as const;

export type Pass59ProductionArea = (typeof PASS_59_REQUIRED_PRODUCTION_AREAS)[number];

export type Pass59EvidenceStatus = 'PENDING_HUMAN_EVIDENCE' | 'APPROVED' | 'REJECTED';

export type Pass59AreaEvidence = {
  area: Pass59ProductionArea;
  status: Pass59EvidenceStatus;
  artifact: string;
  requiredEvidence: readonly string[];
  evidenceReferences?: readonly string[];
  approvedBy?: string | null;
  approvedAt?: string | null;
};

export type Pass59ProductionGateSnapshot = {
  gateStatus: Pass59EvidenceStatus;
  customerEvidenceAllowed: boolean;
  approvalRequiredBeforeCustomerEvidence: boolean;
  approvalReference?: string | null;
  requiredAreas: readonly Pass59AreaEvidence[];
};

export const PASS_59_REQUIRED_REAL_EVIDENCE: Readonly<Record<Pass59ProductionArea, readonly string[]>> = {
  security: [
    'independent threat review',
    'cross-tenant/IDOR tests',
    'CSRF tests',
    'upload validation',
    'dependency scanning',
    'secret rotation procedure',
  ],
  files: [
    'private encrypted storage',
    'malware scanning',
    'object reconciliation',
    'download authorization tests',
  ],
  recovery: ['managed backups/PITR', 'documented restore test', 'explicit RPO/RTO'],
  observability: [
    'request IDs',
    'structured redacted logs',
    'error tracking',
    'uptime checks',
    'storage/database/worker alerts',
  ],
  privacy: [
    'retention/deletion terms',
    'DPA/subprocessor inventory',
    'AI provider data handling',
    'incident notification process',
  ],
  performance: ['representative load test', 'typical list/detail API p95 target <= 500ms'],
  accessibility: ['keyboard primary workflows', 'semantic forms/tables', 'non-color status cues'],
  operations: ['staging environment', 'CI/CD evidence', 'migration/release checklist', 'incident runbooks', 'support escalation owner'],
};

function missingFrom(required: readonly string[], provided: readonly string[]): string[] {
  const providedSet = new Set(provided);
  return required.filter((item) => !providedSet.has(item));
}

function looksPlaceholder(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim().toLowerCase();
  return text.length === 0 || text === 'todo' || text === 'tbd' || text === 'pending' || text.includes('placeholder');
}

export function assertPass59RequiredAreaCoverage(areas: readonly Pass59AreaEvidence[]): void {
  const areaNames = areas.map((entry) => entry.area);
  const missingAreas = missingFrom(PASS_59_REQUIRED_PRODUCTION_AREAS, areaNames);
  if (missingAreas.length > 0) {
    throw new Error(`Pass 59 production gate missing areas: ${missingAreas.join(', ')}`);
  }

  for (const area of PASS_59_REQUIRED_PRODUCTION_AREAS) {
    const entry = areas.find((candidate) => candidate.area === area);
    if (!entry) continue;
    const required = PASS_59_REQUIRED_REAL_EVIDENCE[area];
    for (const token of required) {
      const normalizedRequired = token.toLowerCase();
      const found = entry.requiredEvidence.some((evidence) => evidence.toLowerCase().includes(normalizedRequired));
      if (!found) {
        throw new Error(`Pass 59 ${area} evidence list missing required token: ${token}`);
      }
    }
  }
}

export function assertPass59NoCustomerEvidenceWithoutStrictApproval(snapshot: Pass59ProductionGateSnapshot): void {
  if (snapshot.approvalRequiredBeforeCustomerEvidence !== true) {
    throw new Error('Pass 59 requires explicit production approval before customer evidence is allowed.');
  }
  if (snapshot.customerEvidenceAllowed === true && snapshot.gateStatus !== 'APPROVED') {
    throw new Error('Pass 59 forbids CUSTOMER_EVIDENCE_ENABLED=true before gateStatus=APPROVED.');
  }
  if (snapshot.customerEvidenceAllowed === true && looksPlaceholder(snapshot.approvalReference)) {
    throw new Error('Pass 59 requires a non-placeholder approval reference before customer evidence is enabled.');
  }
}

export function assertPass59StrictEvidenceReady(snapshot: Pass59ProductionGateSnapshot): void {
  assertPass59RequiredAreaCoverage(snapshot.requiredAreas);
  assertPass59NoCustomerEvidenceWithoutStrictApproval(snapshot);

  if (snapshot.gateStatus !== 'APPROVED') {
    throw new Error('Pass 59 strict evidence gate is not approved.');
  }
  if (snapshot.customerEvidenceAllowed !== true) {
    throw new Error('Pass 59 strict evidence gate approval must explicitly allow customer evidence.');
  }
  if (looksPlaceholder(snapshot.approvalReference)) {
    throw new Error('Pass 59 strict evidence gate requires a real approval reference.');
  }

  for (const area of snapshot.requiredAreas) {
    if (area.status !== 'APPROVED') {
      throw new Error(`Pass 59 ${area.area} gate is not approved.`);
    }
    if (looksPlaceholder(area.approvedBy) || looksPlaceholder(area.approvedAt)) {
      throw new Error(`Pass 59 ${area.area} gate requires approvedBy and approvedAt.`);
    }
    if (!area.evidenceReferences || area.evidenceReferences.length === 0 || area.evidenceReferences.some(looksPlaceholder)) {
      throw new Error(`Pass 59 ${area.area} gate requires non-placeholder evidence references.`);
    }
  }
}

export function buildPass59BlockedProductionGateSnapshot(): Pass59ProductionGateSnapshot {
  return {
    gateStatus: 'PENDING_HUMAN_EVIDENCE',
    customerEvidenceAllowed: false,
    approvalRequiredBeforeCustomerEvidence: true,
    approvalReference: null,
    requiredAreas: PASS_59_REQUIRED_PRODUCTION_AREAS.map((area) => ({
      area,
      status: 'PENDING_HUMAN_EVIDENCE',
      artifact: `docs/production-gates/${area}.md`,
      requiredEvidence: PASS_59_REQUIRED_REAL_EVIDENCE[area],
      evidenceReferences: [],
      approvedBy: null,
      approvedAt: null,
    })),
  };
}

export function assertPass59ProductionGateContract(): void {
  const blocked = buildPass59BlockedProductionGateSnapshot();
  assertPass59RequiredAreaCoverage(blocked.requiredAreas);
  assertPass59NoCustomerEvidenceWithoutStrictApproval(blocked);
  try {
    assertPass59StrictEvidenceReady(blocked);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not approved')) return;
    throw error;
  }
  throw new Error('Pass 59 blocked snapshot unexpectedly passed strict evidence approval.');
}
