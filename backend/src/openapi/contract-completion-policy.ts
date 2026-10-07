import type { ApiContractRoute } from './api-contract.types.js';

export const API_CONTRACT_COMPLETION_PASS = 'Pass 50' as const;

export const REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS = [
  'operationId',
  'authentication',
  'authorization.exactPermission',
  'authorization.resourceOwnershipPredicate',
  'pathQueryBodySchemas',
  'successResponseEnvelopeSchema',
  'documentedErrorSet',
  'idempotencyRule',
  'concurrencyPrecondition',
  'auditEventDeclaration',
  'rateLimitPolicy',
] as const;

export type ApiContractCompletionElement = (typeof REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS)[number];

export type ApiContractCompletionIssue = {
  method: ApiContractRoute['method'];
  path: string;
  operationId: string;
  field: string;
  message: string;
};

const MUTATING_METHODS = new Set<ApiContractRoute['method']>(['POST', 'PATCH', 'DELETE']);

function issue(route: ApiContractRoute, field: string, message: string): ApiContractCompletionIssue {
  return {
    method: route.method,
    path: route.path,
    operationId: route.operationId || '<missing-operation-id>',
    field,
    message,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasPathParam(path: string): boolean {
  return /:[A-Za-z0-9_]+/.test(path);
}

export function isStateChangingRoute(route: Pick<ApiContractRoute, 'method'>): boolean {
  return MUTATING_METHODS.has(route.method);
}

export function validateRouteContractCompletion(route: ApiContractRoute): ApiContractCompletionIssue[] {
  const issues: ApiContractCompletionIssue[] = [];

  if (route.version !== 'v1') issues.push(issue(route, 'version', 'Route contract must be versioned as v1.'));
  if (!/^[a-z][A-Za-z0-9]+$/.test(route.operationId)) {
    issues.push(issue(route, 'operationId', 'operationId must be stable camelCase and unique across the registry.'));
  }
  if (!route.tags?.length) issues.push(issue(route, 'tags', 'At least one OpenAPI tag is required.'));
  if (!isNonEmptyString(route.summary)) issues.push(issue(route, 'summary', 'A non-empty route summary is required.'));

  if (route.authentication.required) {
    if (route.authentication.scheme !== 'opaque-server-side-session-cookie') {
      issues.push(issue(route, 'authentication.scheme', 'Authenticated browser routes must use opaque server-side session cookies.'));
    }
    if (route.authentication.cookieName !== 'auditflow_session') {
      issues.push(issue(route, 'authentication.cookieName', 'Authenticated browser routes must declare auditflow_session.'));
    }
    if (isStateChangingRoute(route) && route.authentication.csrfRequiredForStateChange !== true) {
      issues.push(issue(route, 'authentication.csrfRequiredForStateChange', 'Authenticated state-changing routes require independent CSRF metadata.'));
    }
  } else if (route.authentication.scheme !== 'none') {
    issues.push(issue(route, 'authentication.scheme', 'Public routes must declare scheme none.'));
  }

  if (!isNonEmptyString(route.authorization?.permission)) {
    issues.push(issue(route, 'authorization.permission', 'Exact permission is required.'));
  }
  if (!isNonEmptyString(route.authorization?.predicate)) {
    issues.push(issue(route, 'authorization.predicate', 'Resource ownership / tenant predicate is required.'));
  }
  if (!isNonEmptyString(route.authorization?.predicateId)) {
    issues.push(issue(route, 'authorization.predicateId', 'Centralized predicate identifier is required.'));
  }

  if (hasPathParam(route.path) && !isNonEmptyString(route.request.pathSchema)) {
    issues.push(issue(route, 'request.pathSchema', 'Routes with path parameters must reference a versioned path schema.'));
  }
  if (!isNonEmptyString(route.request.contentType)) {
    issues.push(issue(route, 'request.contentType', 'Request content type must be declared even for no-body routes.'));
  }
  if (!Array.isArray(route.request.headers) || !route.request.headers.some((header) => header.includes('x-request-id'))) {
    issues.push(issue(route, 'request.headers', 'Request header documentation must include x-request-id behavior.'));
  }

  if (route.successResponse.status < 200 || route.successResponse.status >= 300) {
    issues.push(issue(route, 'successResponse.status', 'Success response status must be a 2xx status.'));
  }
  if (!isNonEmptyString(route.successResponse.schema)) {
    issues.push(issue(route, 'successResponse.schema', 'Success response schema or explicit NoContent/Binary schema is required.'));
  }
  if (!Array.isArray(route.errors) || route.errors.length === 0) {
    issues.push(issue(route, 'errors', 'Documented error set is required.'));
  }
  if (route.authentication.required) {
    for (const expectedStatus of [401, 403]) {
      if (!route.errors.includes(expectedStatus)) {
        issues.push(issue(route, 'errors', `Authenticated route must document ${expectedStatus}.`));
      }
    }
  }

  if (typeof route.idempotency?.supported !== 'boolean') {
    issues.push(issue(route, 'idempotency.supported', 'Idempotency support must be explicitly true or false.'));
  }
  if (!isNonEmptyString(route.idempotency?.rule)) {
    issues.push(issue(route, 'idempotency.rule', 'Idempotency rule is required, even when unsupported.'));
  }
  if (route.idempotency.supported) {
    if (route.idempotency.header !== 'Idempotency-Key') {
      issues.push(issue(route, 'idempotency.header', 'Supported idempotent routes must document Idempotency-Key.'));
    }
    if (!isNonEmptyString(route.idempotency.scope)) {
      issues.push(issue(route, 'idempotency.scope', 'Supported idempotent routes must document deduplication scope.'));
    }
    if (!/replay/i.test(route.idempotency.rule)) {
      issues.push(issue(route, 'idempotency.rule', 'Supported idempotent routes must document replay behavior.'));
    }
  }

  if (!isNonEmptyString(route.concurrency?.strategy)) {
    issues.push(issue(route, 'concurrency.strategy', 'Concurrency strategy is required.'));
  }
  if (!isNonEmptyString(route.concurrency?.rule)) {
    issues.push(issue(route, 'concurrency.rule', 'Concurrency precondition/rule is required.'));
  }
  if (!route.audit || route.audit.event === undefined || route.audit.event === null || route.audit.event === '') {
    issues.push(issue(route, 'audit.event', 'Audit event code or explicit none is required.'));
  }
  if (!isNonEmptyString(route.rateLimit?.policy)) {
    issues.push(issue(route, 'rateLimit.policy', 'Named rate-limit policy is required.'));
  }

  return issues;
}

export function assertRouteContractCompletion(route: ApiContractRoute): void {
  const issues = validateRouteContractCompletion(route);
  if (issues.length) {
    const details = issues.map((entry) => `${entry.method} ${entry.path} ${entry.field}: ${entry.message}`).join('\n');
    throw new Error(`Incomplete AuditFlow API contract for ${route.method} ${route.path}\n${details}`);
  }
}
