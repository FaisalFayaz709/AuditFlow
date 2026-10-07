import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type RouteContract = {
  version: string;
  method: string;
  path: string;
  operationId: string;
  tags: string[];
  summary: string;
  authentication: { required: boolean; scheme: string; csrfRequiredForStateChange: boolean };
  authorization: { permission: string; predicate: string };
  request: { headers: string[]; pathSchema: string | null; querySchema: string | null; bodySchema: string | null; contentType: string };
  successResponse: { status: number; schema: string; envelope: boolean };
  errors: number[];
  idempotency: { supported: boolean; rule: string };
  concurrency: { strategy: string; rule: string };
  audit: { event: string; sameTransactionWhereFeasible: boolean };
  rateLimit: { policy: string };
};

function loadContracts(): RouteContract[] {
  const raw = readFileSync(new URL('../src/openapi/route-contracts.v1.json', import.meta.url), 'utf8');
  return JSON.parse(raw).routes as RouteContract[];
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function extractImplementedRoutes(): Array<{ method: string; path: string }> {
  const modulesDir = new URL('../src/modules', import.meta.url);
  return walk(modulesDir.pathname)
    .filter((file) => file.endsWith('.routes.ts'))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const matches = [...text.matchAll(/app\.(get|post|patch|delete)\('([^']+)'/g)];
      return matches.map((match) => ({ method: match[1].toUpperCase(), path: match[2] }));
    });
}

describe('Pass 13 API contract completion registry', () => {
  const contracts = loadContracts();

  it('documents every implemented Fastify route exactly once', () => {
    const implemented = extractImplementedRoutes();
    const contractKeys = new Set(contracts.map((contract) => `${contract.method} ${contract.path}`));
    const implementedKeys = new Set(implemented.map((route) => `${route.method} ${route.path}`));
    expect([...implementedKeys].sort()).toEqual([...contractKeys].sort());
  });

  it('has unique operationIds and versioned contracts', () => {
    expect(new Set(contracts.map((contract) => contract.operationId)).size).toBe(contracts.length);
    for (const contract of contracts) {
      expect(contract.version).toBe('v1');
      expect(contract.operationId).toMatch(/^[a-z][A-Za-z0-9]+$/);
      expect(contract.tags.length).toBeGreaterThan(0);
    }
  });

  it('contains the mandatory v2.1 completion fields for each route', () => {
    for (const contract of contracts) {
      expect(contract.summary).not.toHaveLength(0);
      expect(contract.authentication.scheme).toMatch(/opaque-server-side-session-cookie|none/);
      expect(contract.authorization.permission).not.toHaveLength(0);
      expect(contract.authorization.predicate).not.toHaveLength(0);
      expect(contract.request.contentType).not.toHaveLength(0);
      expect(contract.successResponse.status).toBeGreaterThanOrEqual(200);
      expect(contract.successResponse.schema).not.toHaveLength(0);
      expect(contract.errors.length).toBeGreaterThan(0);
      expect(contract.idempotency.rule).not.toHaveLength(0);
      expect(contract.concurrency.strategy).not.toHaveLength(0);
      expect(contract.concurrency.rule).not.toHaveLength(0);
      expect(contract.audit.event).not.toHaveLength(0);
      expect(contract.rateLimit.policy).not.toHaveLength(0);
    }
  });

  it('keeps state-changing authenticated routes CSRF protected in the contract', () => {
    for (const contract of contracts.filter((route) => route.authentication.required && route.method !== 'GET')) {
      expect(contract.authentication.csrfRequiredForStateChange).toBe(true);
    }
  });

  it('generates an OpenAPI artifact from the same source contract registry', () => {
    const generated = new URL('../../docs/openapi/auditflow.openapi.v1.json', import.meta.url);
    expect(existsSync(generated)).toBe(true);
    const openapi = JSON.parse(readFileSync(generated, 'utf8'));
    const operationIds = Object.values(openapi.paths).flatMap((pathItem: any) => Object.values(pathItem).map((operation: any) => operation.operationId));
    expect(new Set(operationIds)).toEqual(new Set(contracts.map((contract) => contract.operationId)));
  });
});
