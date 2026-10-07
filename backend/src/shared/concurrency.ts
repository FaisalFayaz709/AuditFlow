import { AppError } from './errors.js';

export const CONCURRENCY_CONFLICT_CODE = 'CONCURRENT_STATE_CHANGE';

export type ConditionalUpdateResult = {
  count: number;
};

export function optimisticConcurrencyConflict(message: string, details?: Array<{ field: string; reason: string }>): AppError {
  return new AppError({
    statusCode: 409,
    code: CONCURRENCY_CONFLICT_CODE,
    message,
    details,
  });
}

export function assertExactlyOneRowUpdated(result: ConditionalUpdateResult, message: string, details?: Array<{ field: string; reason: string }>) {
  if (result.count !== 1) {
    throw optimisticConcurrencyConflict(message, details);
  }
}

export function assertNoConcurrentTerminalState(params: {
  count: number;
  entity: string;
  id: string;
  expectedState: string;
}) {
  assertExactlyOneRowUpdated(
    { count: params.count },
    `${params.entity} changed state before this mutation could be committed. Reload and retry.`,
    [
      { field: 'id', reason: params.id },
      { field: 'expectedState', reason: params.expectedState },
    ],
  );
}

export function normalizeIdempotencyKey(raw?: string | null): string | undefined {
  const key = raw?.trim();
  if (!key) return undefined;
  if (key.length > 200) {
    throw new AppError({
      statusCode: 422,
      code: 'IDEMPOTENCY_KEY_TOO_LONG',
      message: 'Idempotency-Key must be 200 characters or fewer.',
      details: [{ field: 'Idempotency-Key', reason: 'max 200 characters' }],
    });
  }
  return key;
}

export function isPrismaUniqueConstraintConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );
}
