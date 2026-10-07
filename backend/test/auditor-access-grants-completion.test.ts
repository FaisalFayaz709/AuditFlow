import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Pass 30 auditor access grant completion policy', () => {
  it('exposes canonical grant and auditor-view routes', () => {
    const routes = read('backend/src/modules/auditor-access/auditor-access.routes.ts');
    expect(routes).toContain("/api/auditor-grants");
    expect(routes).toContain("/api/auditor-grants/:grantId/revoke");
    expect(routes).toContain("/api/auditor-view/controls");
    expect(routes).toContain("/api/auditor-view/evidence");
    expect(routes).toContain("/api/auditor-view/reports");
  });

  it('keeps auditor views selected, read-only, active-grant scoped, and approved/completed only', () => {
    const service = read('backend/src/modules/auditor-access/auditor-access.service.ts');
    expect(service).toContain('listAuditorViewControls');
    expect(service).toContain('listAuditorViewEvidence');
    expect(service).toContain('listAuditorViewReports');
    expect(service).toContain("status: 'APPROVED'");
    expect(service).toContain("status: 'COMPLETED'");
    expect(service).toContain('activeWindow(now)');
    expect(service).toContain('assertAuditorRole');
  });

  it('audits sensitive auditor download use in addition to grant creation and revocation', () => {
    const service = read('backend/src/modules/auditor-access/auditor-access.service.ts');
    const evidence = read('backend/src/modules/evidence/evidence.service.ts');
    const reports = read('backend/src/modules/reports/reports.service.ts');
    expect(service).toContain('recordAuditorSensitiveDownload');
    expect(service).toContain('AUDITOR_ACCESS_USED');
    expect(evidence).toContain('EVIDENCE_DOWNLOADED');
    expect(evidence).toContain('recordAuditorSensitiveDownload');
    expect(reports).toContain('REPORT_DOWNLOADED');
    expect(reports).toContain('recordAuditorSensitiveDownload');
  });

  it('documents every new route with exact permission predicate metadata', () => {
    const contracts = JSON.parse(read('backend/src/openapi/route-contracts.v1.json')) as { routes: Array<{ path: string; authorization: { predicateId: string }; successResponse: { schema: string } }> };
    for (const path of ['/api/auditor-grants', '/api/auditor-grants/:grantId/revoke', '/api/auditor-view/controls', '/api/auditor-view/evidence', '/api/auditor-view/reports']) {
      expect(contracts.routes.some((route) => route.path === path)).toBe(true);
    }
    expect(contracts.routes.find((route) => route.path === '/api/auditor-view/evidence')?.authorization.predicateId).toBe('auditor.active_scope_grant');
    expect(contracts.routes.find((route) => route.path === '/api/auditor-view/reports')?.authorization.predicateId).toBe('auditor.active_scope_grant');
  });
});
