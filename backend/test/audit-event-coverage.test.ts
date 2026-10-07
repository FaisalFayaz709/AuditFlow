import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type RouteContract = {
  method: string;
  path: string;
  operationId: string;
  authentication: { required: boolean };
  audit: { event: string; sameTransactionWhereFeasible: boolean };
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = join(__dirname, '../src/openapi/route-contracts.v1.json');
const contracts = JSON.parse(readFileSync(contractsPath, 'utf8')) as { routes: RouteContract[] };
const routes = contracts.routes;
const stateChangingMethods = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);
const explicitNoAuditOperations = new Set([
  // These are intentionally excluded only if a future pass documents why.
]);

describe('Pass 14 audit-event acceptance invariants', () => {
  it('declares a stable audit event for every implemented state-changing route', () => {
    const offenders = routes
      .filter((route) => stateChangingMethods.has(route.method))
      .filter((route) => !explicitNoAuditOperations.has(route.operationId))
      .filter((route) => route.audit.event === 'none')
      .map((route) => `${route.method} ${route.path} (${route.operationId})`);

    expect(offenders).toEqual([]);
  });

  it('requires same-transaction audit intent where feasible for protected business mutations', () => {
    const exemptPrefixes = ['/api/auth/logout'];
    const offenders = routes
      .filter((route) => stateChangingMethods.has(route.method))
      .filter((route) => route.authentication.required)
      .filter((route) => !exemptPrefixes.some((prefix) => route.path.startsWith(prefix)))
      .filter((route) => route.audit.sameTransactionWhereFeasible !== true)
      .map((route) => `${route.method} ${route.path} (${route.audit.event})`);

    expect(offenders).toEqual([]);
  });
});
