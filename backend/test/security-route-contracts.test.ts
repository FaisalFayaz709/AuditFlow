import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type RouteContract = {
  method: string;
  path: string;
  operationId: string;
  authentication: {
    required: boolean;
    scheme: string;
    csrfRequiredForStateChange: boolean;
  };
  authorization: {
    permission: string;
    predicate: string;
  };
  request: {
    headers: string[];
  };
  audit: {
    event: string;
  };
  errors: number[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsPath = join(__dirname, '../src/openapi/route-contracts.v1.json');
const contracts = JSON.parse(readFileSync(contractsPath, 'utf8')) as { routes: RouteContract[] };
const routes = contracts.routes;
const stateChangingMethods = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);
const publicStateChangingAuthRoutes = new Set([
  'POST /api/auth/register',
  'POST /api/auth/login',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'POST /api/auth/verify-email',
]);

describe('Pass 14 route security acceptance invariants', () => {
  it('requires independent CSRF protection for every authenticated state-changing route', () => {
    const offenders = routes
      .filter((route) => stateChangingMethods.has(route.method))
      .filter((route) => route.authentication.required)
      .filter((route) => route.authentication.csrfRequiredForStateChange !== true)
      .map((route) => `${route.method} ${route.path}`);

    expect(offenders).toEqual([]);
  });

  it('keeps unauthenticated state-changing routes limited to the documented public auth lifecycle', () => {
    const publicMutations = routes
      .filter((route) => stateChangingMethods.has(route.method))
      .filter((route) => route.authentication.required === false)
      .map((route) => `${route.method} ${route.path}`)
      .sort();

    expect(publicMutations).toEqual([...publicStateChangingAuthRoutes].sort());
  });

  it('declares tenant membership/resource-scope predicates for protected tenant routes', () => {
    const exemptPrefixes = ['/health', '/api/auth'];
    const offenders = routes
      .filter((route) => route.authentication.required)
      .filter((route) => !exemptPrefixes.some((prefix) => route.path.startsWith(prefix)))
      .filter((route) => {
        const predicate = route.authorization.predicate.toLowerCase();
        return !predicate.includes('tenant') && !predicate.includes('active') && !predicate.includes('membership');
      })
      .map((route) => `${route.method} ${route.path} -> ${route.authorization.predicate}`);

    expect(offenders).toEqual([]);
  });

  it('documents tenant company-context header for protected non-auth routes', () => {
    const offenders = routes
      .filter((route) => route.authentication.required)
      .filter((route) => !route.path.startsWith('/api/auth'))
      .filter((route) => !route.request.headers.some((header) => header.includes('x-auditflow-company-id')))
      .map((route) => `${route.method} ${route.path}`);

    expect(offenders).toEqual([]);
  });

  it('documents authorization-failure status codes on protected routes', () => {
    const offenders = routes
      .filter((route) => route.authentication.required)
      .filter((route) => !route.errors.includes(401) || !route.errors.includes(403))
      .map((route) => `${route.method} ${route.path}`);

    expect(offenders).toEqual([]);
  });
});
