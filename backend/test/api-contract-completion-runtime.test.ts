import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS, validateRouteContractCompletion } from '../src/openapi/contract-completion-policy';
import type { ApiContractRoute } from '../src/openapi/api-contract.types';

type Registry = {
  generatedFromPass: string;
  completionStandard: { routeCompleteOnlyWhen: string[]; customerEvidenceRelease: string };
  routes: ApiContractRoute[];
};

type AnyObject = Record<string, any>;

function loadJson<T>(relative: string): T {
  return JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as T;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function implementedRoutes(): Array<{ method: string; path: string }> {
  const modulesDir = new URL('../src/modules', import.meta.url);
  return walk(modulesDir.pathname)
    .filter((file) => file.endsWith('.routes.ts'))
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/app\.(get|post|patch|delete)\('([^']+)'/g)].map((match) => ({
        method: match[1].toUpperCase(),
        path: match[2],
      }));
    });
}

describe('Pass 50 API contract completion runtime gate', () => {
  const registry = loadJson<Registry>('../src/openapi/route-contracts.v1.json');
  const schemaRegistry = loadJson<{ schemas: Record<string, unknown> }>('../src/openapi/route-schemas.v1.json');
  const openapi = loadJson<AnyObject>('../../docs/openapi/auditflow.openapi.v1.json');
  const routes = registry.routes;

  it('declares the locked v2.1 completion standard for every route', () => {
    expect(registry.generatedFromPass).toBe('Pass 50 API Contract Completion');
    expect(registry.completionStandard.customerEvidenceRelease).toBe('blockedUntilProductionGatePasses');
    expect(registry.completionStandard.routeCompleteOnlyWhen).toEqual([...REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS]);

    const issues = routes.flatMap((route) => validateRouteContractCompletion(route));
    expect(issues).toEqual([]);
  });

  it('keeps the implementation route registry one-to-one with Fastify route files', () => {
    const implemented = implementedRoutes().map((route) => `${route.method} ${route.path}`).sort();
    const documented = routes.map((route) => `${route.method} ${route.path}`).sort();
    expect(documented).toEqual(implemented);
    expect(new Set(routes.map((route) => route.operationId)).size).toBe(routes.length);
  });

  it('requires schema registry entries for path, query, body, and success schemas', () => {
    const schemaNames = new Set(Object.keys(schemaRegistry.schemas));
    for (const route of routes) {
      const referenced = [route.request.pathSchema, route.request.querySchema, route.request.bodySchema, route.successResponse.schema]
        .filter(Boolean)
        .filter((name): name is string => !String(name).startsWith('multipart:') && !String(name).startsWith('Binary') && name !== 'NoContent');
      for (const schemaName of referenced) {
        expect(schemaNames.has(schemaName), `${route.method} ${route.path} references missing schema ${schemaName}`).toBe(true);
      }
    }
  });

  it('documents Idempotency-Key scope and replay behavior wherever idempotency is supported', () => {
    const supportedRoutes = routes.filter((route) => route.idempotency.supported);
    expect(supportedRoutes.length).toBeGreaterThan(0);
    for (const route of supportedRoutes) {
      expect(route.idempotency.header).toBe('Idempotency-Key');
      expect(route.idempotency.scope).toMatch(/tenant/i);
      expect(route.idempotency.rule).toMatch(/replay/i);
    }
  });

  it('requires independent CSRF metadata for authenticated state-changing routes', () => {
    for (const route of routes.filter((candidate) => candidate.authentication.required && candidate.method !== 'GET')) {
      expect(route.authentication.scheme).toBe('opaque-server-side-session-cookie');
      expect(route.authentication.cookieName).toBe('auditflow_session');
      expect(route.authentication.csrfRequiredForStateChange, `${route.method} ${route.path}`).toBe(true);
    }
  });

  it('emits generated OpenAPI completion metadata from the same route registry', () => {
    expect(openapi['x-auditflow-contract-completion-standard'].requiredElements).toEqual([...REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS]);
    const operations = Object.values(openapi.paths).flatMap((pathItem: any) => Object.values(pathItem) as AnyObject[]);
    expect(operations.length).toBe(routes.length);
    for (const operation of operations) {
      expect(operation['x-auditflow-contract']).toBeDefined();
      expect(operation['x-auditflow-contract'].completionStandard).toMatchObject({
        pass: 'Pass 50',
        implementationComplete: true,
      });
      expect(operation['x-auditflow-contract'].authorization.permission).toBeTruthy();
      expect(operation['x-auditflow-contract'].authorization.predicateId).toBeTruthy();
      expect(operation['x-auditflow-contract'].idempotency.rule).toBeTruthy();
      expect(operation['x-auditflow-contract'].concurrency.rule).toBeTruthy();
      expect(operation['x-auditflow-contract'].audit.event === 'none' || operation['x-auditflow-contract'].audit.event.length > 0).toBe(true);
      expect(operation['x-auditflow-contract'].rateLimit.policy).toBeTruthy();
    }
  });

  it('keeps customer-evidence release blocked by contract metadata', () => {
    expect(JSON.stringify(registry)).toContain('customerEvidenceRelease');
    expect(JSON.stringify(openapi)).toContain('blockedUntilProductionGatePasses');
  });
});
