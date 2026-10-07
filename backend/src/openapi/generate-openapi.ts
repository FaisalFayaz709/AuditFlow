import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { ApiContractRoute } from './api-contract.types.js';
import { API_CONTRACT_COMPLETION_PASS, REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS, validateRouteContractCompletion } from './contract-completion-policy.js';

type ContractFile = { schemaVersion: string; routes: ApiContractRoute[] };
type SchemaRegistryFile = { schemaVersion: string; schemas: Record<string, unknown> };

const contractsUrl = new URL('./route-contracts.v1.json', import.meta.url);
const schemaRegistryUrl = new URL('./route-schemas.v1.json', import.meta.url);
const contracts = JSON.parse(readFileSync(contractsUrl, 'utf8')) as ContractFile;
const schemaRegistry = JSON.parse(readFileSync(schemaRegistryUrl, 'utf8')) as SchemaRegistryFile;

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function isInlineSchemaName(name: string | null | undefined): boolean {
  return Boolean(name && (name.startsWith('multipart:') || name.startsWith('Binary') || name === 'NoContent'));
}

function schemaRef(name: string | null | undefined) {
  if (!name || name === 'NoContent') return undefined;
  if (name.startsWith('multipart:')) {
    return {
      type: 'object',
      description: name,
      properties: {
        file: { type: 'string', format: 'binary' },
        metadata: { type: 'object', additionalProperties: true },
      },
      required: ['file'],
    };
  }
  if (name.startsWith('Binary')) {
    return { type: 'string', format: 'binary', description: name };
  }
  return { $ref: `#/components/schemas/${name}` };
}

function assertSchemaExists(name: string | null | undefined, route: ApiContractRoute, location: string) {
  if (!name || isInlineSchemaName(name)) return;
  if (!schemaRegistry.schemas[name]) {
    throw new Error(`${route.method} ${route.path} ${location} references missing OpenAPI component schema ${name}`);
  }
}

function makeParameters(route: ApiContractRoute) {
  const params: unknown[] = [];
  const pathMatches = [...route.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  for (const name of pathMatches) {
    params.push({ name, in: 'path', required: true, schema: { type: 'string', minLength: 1 } });
  }
  if (route.request.querySchema) {
    params.push({
      name: 'query',
      in: 'query',
      required: false,
      style: 'deepObject',
      explode: true,
      schema: schemaRef(route.request.querySchema),
      description: `Query parameters follow ${route.request.querySchema}.`,
    });
  }
  if (route.authentication.required) {
    params.push({
      name: 'x-auditflow-company-id',
      in: 'header',
      required: !route.path.startsWith('/api/auth'),
      schema: { type: 'string', minLength: 1 },
      description: 'Tenant context header for company-owned data; ignored for routes that resolve company from session only.',
    });
  }
  if (route.authentication.csrfRequiredForStateChange) {
    params.push({
      name: 'x-csrf-token',
      in: 'header',
      required: true,
      schema: { type: 'string', minLength: 16 },
      description: 'Independent CSRF token for state-changing requests.',
    });
  }
  if (route.idempotency.supported && route.idempotency.header) {
    params.push({
      name: route.idempotency.header,
      in: 'header',
      required: false,
      schema: { type: 'string', minLength: 8 },
      description: route.idempotency.rule,
    });
  }
  return params;
}

function assertRouteComplete(route: ApiContractRoute) {
  const completionIssues = validateRouteContractCompletion(route);
  if (completionIssues.length) {
    const details = completionIssues.map((entry) => `${entry.method} ${entry.path} ${entry.field}: ${entry.message}`).join('\n');
    throw new Error(`Incomplete AuditFlow API contract\n${details}`);
  }
  assertSchemaExists(route.request.pathSchema, route, 'pathSchema');
  assertSchemaExists(route.request.querySchema, route, 'querySchema');
  assertSchemaExists(route.request.bodySchema, route, 'bodySchema');
  assertSchemaExists(route.successResponse.schema, route, 'successResponse.schema');
}

const openapi: any = {
  openapi: '3.1.0',
  info: {
    title: 'AuditFlow API',
    version: 'v1',
    description: 'Generated from AuditFlow v2.1 Pass 50 route contract registry. A route is not implementation-complete until operation ID, auth/session behavior, exact authorization predicate, path/query/body schemas, success/error responses, idempotency, concurrency, audit event declaration, and rate-limit policy are present and contract-tested.',
  },
  'x-auditflow-contract-completion-standard': {
    pass: API_CONTRACT_COMPLETION_PASS,
    requiredElements: REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS,
    customerEvidenceRelease: 'blockedUntilProductionGatePasses',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development backend' }],
  tags: [...new Set(contracts.routes.flatMap((route) => route.tags))].map((name) => ({ name })),
  paths: {},
  components: {
    securitySchemes: {
      AuditFlowSessionCookie: { type: 'apiKey', in: 'cookie', name: 'auditflow_session' },
      AuditFlowCsrfToken: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
    },
    schemas: schemaRegistry.schemas,
  },
};

for (const route of contracts.routes) {
  assertRouteComplete(route);
  const openPath = toOpenApiPath(route.path);
  openapi.paths[openPath] ??= {};
  const method = route.method.toLowerCase();
  const successSchema = schemaRef(route.successResponse.schema);
  const successContent = route.successResponse.status === 204
    ? undefined
    : {
        'application/json': {
          schema: route.successResponse.envelope
            ? {
                type: 'object',
                required: ['data', 'meta'],
                properties: {
                  data: successSchema ?? { type: 'object' },
                  meta: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
                },
              }
            : successSchema ?? { type: 'object' },
        },
      };
  const requestSchema = schemaRef(route.request.bodySchema);
  openapi.paths[openPath][method] = {
    operationId: route.operationId,
    tags: route.tags,
    summary: route.summary,
    security: route.authentication.required ? [{ AuditFlowSessionCookie: [] }] : [],
    parameters: makeParameters(route),
    requestBody: requestSchema ? { required: true, content: { [route.request.contentType]: { schema: requestSchema } } } : undefined,
    responses: {
      [String(route.successResponse.status)]: {
        description: route.successResponse.schema,
        content: successContent,
      },
      ...Object.fromEntries(route.errors.map((status) => [String(status), {
        description: `Documented error ${status}`,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      }])),
    },
    'x-auditflow-contract': {
      version: route.version,
      requestSchemas: {
        pathSchema: route.request.pathSchema,
        querySchema: route.request.querySchema,
        bodySchema: route.request.bodySchema,
      },
      authentication: route.authentication,
      authorization: route.authorization,
      idempotency: route.idempotency,
      concurrency: route.concurrency,
      audit: route.audit,
      rateLimit: route.rateLimit,
      completionStandard: {
        pass: API_CONTRACT_COMPLETION_PASS,
        implementationComplete: true,
        requiredElements: REQUIRED_API_CONTRACT_COMPLETION_ELEMENTS,
      },
    },
  };
}

const outputPath = resolve(process.cwd(), 'docs/openapi/auditflow.openapi.v1.json');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(openapi, null, 2)}\n`);
console.log(`Generated ${outputPath} from ${contracts.routes.length} route contracts and ${Object.keys(schemaRegistry.schemas).length} component schemas.`);
