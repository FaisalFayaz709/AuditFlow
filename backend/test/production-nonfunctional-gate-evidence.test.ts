import { describe, expect, it } from 'vitest';
import {
  collectProductionGateEvidenceFailures,
  PRODUCTION_GATE_REQUIRED_AREAS,
  PRODUCTION_GATE_REQUIRED_RUNBOOKS,
  type ProductionGateEvidenceManifest,
} from '../src/shared/production-nonfunctional-gate.js';

describe('Pass 39 production non-functional gate evidence model', () => {
  const pendingManifest: ProductionGateEvidenceManifest = {
    schemaVersion: 'auditflow.productionGateEvidence.v1',
    gateStatus: 'PENDING_HUMAN_EVIDENCE',
    customerEvidenceAllowed: false,
    approvalRequiredBeforeCustomerEvidence: true,
    requiredAreas: PRODUCTION_GATE_REQUIRED_AREAS.map((area) => ({
      area,
      artifact: `docs/production-gates/${area}.md`,
      requiredEvidence: ['runtime evidence'],
      status: 'PENDING_HUMAN_EVIDENCE',
    })),
  };

  it('allows a pending evidence pack while keeping customer evidence disabled', () => {
    expect(collectProductionGateEvidenceFailures(pendingManifest)).toEqual([]);
  });

  it('requires every area to be approved before the gate can be approved', () => {
    const failures = collectProductionGateEvidenceFailures({ ...pendingManifest, gateStatus: 'APPROVED' });
    expect(failures).toEqual(expect.arrayContaining([expect.stringContaining('security must be APPROVED')]));
  });

  it('rejects customer evidence enablement when the gate remains pending', () => {
    const failures = collectProductionGateEvidenceFailures({ ...pendingManifest, customerEvidenceAllowed: true });
    expect(failures).toContain('customerEvidenceAllowed cannot be true unless gateStatus is APPROVED');
  });

  it('keeps all v2.1 incident runbook categories represented', () => {
    expect(PRODUCTION_GATE_REQUIRED_RUNBOOKS).toEqual([
      'suspected cross-tenant access',
      'malware upload',
      'database outage',
      'object storage outage',
      'AI provider outage',
      'worker/Redis outage',
      'credential leak',
      'failed migration',
    ]);
  });
});
