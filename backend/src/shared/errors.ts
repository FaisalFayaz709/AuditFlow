export type ErrorDetails = Array<{ field?: string; reason: string }>;

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: ErrorDetails;

  constructor(params: {
    statusCode: number;
    code: string;
    message: string;
    details?: ErrorDetails;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details ?? [];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}


export function tenantSafeNotFoundError(entityType: string): AppError {
  return new AppError({
    statusCode: 404,
    code: `${entityType.toUpperCase()}_NOT_FOUND`,
    message: `${entityType} was not found.`,
    details: [],
  });
}

export function isTenantSafeErrorDetails(details: ErrorDetails): boolean {
  return details.length === 0;
}
