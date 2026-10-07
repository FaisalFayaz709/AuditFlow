import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type AnyObject = Record<string, any>;

function loadJson(path: string): AnyObject {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as AnyObject;
}

function collectRefs(value: unknown, refs = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return refs;
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return refs;
  }
  const object = value as AnyObject;
  if (typeof object.$ref === 'string') refs.add(object.$ref);
  for (const child of Object.values(object)) collectRefs(child, refs);
  return refs;
}

describe('Pass 23 v2.1 OpenAPI contract completion', () => {
  const contracts = loadJson('../src/openapi/route-contracts.v1.json');
  const schemaRegistry = loadJson('../src/openapi/route-schemas.v1.json');
  const openapi = loadJson('../../docs/openapi/auditflow.openapi.v1.json');
  const routes = contracts.routes as AnyObject[];
  const operations = Object.values(openapi.paths).flatMap((pathItem: any) => Object.values(pathItem) as AnyObject[]);

  it('has a component schema for every route-referenced request, query, path, and success schema', () => {
    const componentNames = new Set(Object.keys(schemaRegistry.schemas));
    for (const route of routes) {
      const names = [route.request.pathSchema, route.request.querySchema, route.request.bodySchema, route.successResponse.schema]
        .filter(Boolean)
        .filter((name: string) => !name.startsWith('multipart:') && !name.startsWith('Binary') && name !== 'NoContent');
      for (const name of names) expect(componentNames.has(name), `${route.method} ${route.path} missing ${name}`).toBe(true);
    }
  });

  it('has no dangling OpenAPI $ref values', () => {
    const componentNames = new Set(Object.keys(openapi.components.schemas));
    const refs = [...collectRefs(openapi)];
    for (const ref of refs) {
      if (ref.startsWith('#/components/schemas/')) {
        const name = ref.replace('#/components/schemas/', '');
        expect(componentNames.has(name), `Dangling schema ref ${ref}`).toBe(true);
      }
    }
  });

  it('keeps every operation implementation-complete under the v2.1 API standard', () => {
    expect(operations.length).toBe(routes.length);
    for (const operation of operations) {
      expect(operation.operationId).toMatch(/^[a-z][A-Za-z0-9]+$/);
      expect(operation['x-auditflow-contract']).toBeDefined();
      const contract = operation['x-auditflow-contract'];
      expect(contract.version).toBe('v1');
      expect(contract.authorization.permission).toBeTruthy();
      expect(contract.authorization.predicate).toBeTruthy();
      expect(contract.idempotency.rule).toBeTruthy();
      expect(contract.concurrency.strategy).toBeTruthy();
      expect(contract.concurrency.rule).toBeTruthy();
      expect(contract.audit.event).toBeDefined();
      expect(contract.audit.event === 'none' || String(contract.audit.event).length > 0).toBe(true);
      expect(contract.rateLimit.policy).toBeTruthy();
    }
  });

  it('documents all error responses with the standard ErrorEnvelope', () => {
    for (const operation of operations) {
      const errorResponses = Object.entries(operation.responses).filter(([status]) => Number(status) >= 400);
      expect(errorResponses.length).toBeGreaterThan(0);
      for (const [, response] of errorResponses as Array<[string, AnyObject]>) {
        expect(response.content['application/json'].schema.$ref).toBe('#/components/schemas/ErrorEnvelope');
      }
    }
  });

  it('requires CSRF metadata for authenticated state-changing operations', () => {
    for (const route of routes.filter((candidate) => candidate.authentication.required && candidate.method !== 'GET')) {
      expect(route.authentication.csrfRequiredForStateChange, `${route.method} ${route.path}`).toBe(true);
    }
  });

  it('does not expose forbidden sensitive implementation fields in generated contracts', () => {
    const text = JSON.stringify(openapi);
    expect(text).not.toContain('storage_key');
    expect(text).not.toContain('rawSessionToken');
    expect(text).not.toContain('current_version_id');
    expect(text).not.toContain('TaskStatus.APPROVED');
    expect(text).not.toContain('certified compliant');
  });
});
