import type { AppEnv } from '../config/env.js';
import { AppError } from './errors.js';

export function assertProductionCustomerEvidenceGateOpen(env: AppEnv): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (env.SECURITY_SCAN_MODE !== 'required') {
    throw new AppError({
      statusCode: 422,
      code: 'PRODUCTION_MALWARE_SCANNING_REQUIRED',
      message: 'Production customer evidence requires SECURITY_SCAN_MODE=required.',
    });
  }

  if (env.SECURITY_SCAN_PROVIDER === 'fake' || env.SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS) {
    throw new AppError({
      statusCode: 422,
      code: 'PRODUCTION_REAL_MALWARE_SCANNER_REQUIRED',
      message: 'Production customer evidence requires a real malware scanner provider and forbids non-production scan bypass.',
    });
  }

  if (env.AI_PROVIDER !== 'disabled' && (env.AI_RELEASE_GATE_STATUS !== 'APPROVED' || !env.AI_RELEASE_GATE_APPROVAL_REFERENCE?.trim())) {
    throw new AppError({
      statusCode: 422,
      code: 'AI_RELEASE_GATE_REQUIRED_FOR_CUSTOMER_EVIDENCE',
      message: 'Production customer evidence with AI enabled requires an approved AI evaluation release gate reference.',
    });
  }

  if (!env.CUSTOMER_EVIDENCE_ENABLED || env.PRODUCTION_GATE_STATUS !== 'APPROVED') {
    throw new AppError({
      statusCode: 422,
      code: 'CUSTOMER_EVIDENCE_GATE_CLOSED',
      message: 'Real customer evidence is blocked until the production non-functional gate is approved.',
    });
  }

  if (!env.PRODUCTION_GATE_APPROVAL_REFERENCE?.trim()) {
    throw new AppError({
      statusCode: 422,
      code: 'PRODUCTION_GATE_APPROVAL_REFERENCE_REQUIRED',
      message: 'Production customer evidence enablement requires a signed gate approval reference.',
    });
  }
}
