export type ApiContractAuthentication = {
  required: boolean;
  scheme: 'opaque-server-side-session-cookie' | 'none';
  cookieName: 'auditflow_session' | null;
  csrfRequiredForStateChange: boolean;
};

export type ApiContractRoute = {
  version: 'v1';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  operationId: string;
  tags: string[];
  summary: string;
  authentication: ApiContractAuthentication;
  authorization: { permission: string; predicate: string; predicateId?: string };
  request: {
    headers: string[];
    pathSchema: string | null;
    querySchema: string | null;
    bodySchema: string | null;
    contentType: string;
  };
  successResponse: { status: number; schema: string; envelope: boolean };
  errors: number[];
  idempotency: { supported: boolean; header?: string; scope?: string; rule: string };
  concurrency: { strategy: string; rule: string };
  audit: { event: string; sameTransactionWhereFeasible: boolean };
  rateLimit: { policy: string };
};
