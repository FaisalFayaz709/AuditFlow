import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { createSecurityScanProvider } from '../security-scan/security-scan.factory.js';
import type { SecurityScanProvider } from '../security-scan/security-scan.types.js';

export type SecurityScanDecision = {
  status: 'NOT_REQUIRED' | 'PENDING' | 'CLEAN' | 'MALICIOUS' | 'FAILED';
  evidenceStatus: 'QUARANTINED' | 'SECURITY_REJECTED' | 'PROCESSING';
  completedAt?: Date | undefined;
  quarantineReason?: string | undefined;
  provider?: string | undefined;
  signature?: string | undefined;
  bypassed?: boolean | undefined;
};

export async function decideInitialSecurityScan(params: {
  env: AppEnv;
  buffer: Buffer;
  fileName: string;
  mimeType?: string | undefined;
  sha256Checksum: string;
  scanner?: SecurityScanProvider;
}): Promise<SecurityScanDecision> {
  if (params.env.NODE_ENV === 'production' && params.env.SECURITY_SCAN_MODE !== 'required') {
    throw new AppError({
      statusCode: 422,
      code: 'PRODUCTION_MALWARE_SCANNING_REQUIRED',
      message: 'Production evidence upload requires malware scanning before real customer evidence is accepted.',
    });
  }

  if (params.env.SECURITY_SCAN_MODE === 'disabled_non_production') {
    if (params.env.NODE_ENV === 'staging' || params.env.NODE_ENV === 'production') {
      throw new AppError({
        statusCode: 422,
        code: 'SECURITY_SCAN_BYPASS_NOT_ALLOWED',
        message: 'Security scanning can only be bypassed in local or test environments.',
      });
    }
    if (!params.env.SECURITY_SCAN_ALLOW_NON_PRODUCTION_BYPASS) {
      throw new AppError({
        statusCode: 422,
        code: 'SECURITY_SCAN_BYPASS_DISABLED',
        message: 'Non-production security scan bypass must be explicitly enabled to use NOT_REQUIRED provenance.',
      });
    }
    return {
      status: 'NOT_REQUIRED',
      evidenceStatus: 'PROCESSING',
      completedAt: new Date(),
      quarantineReason: 'Security scan explicitly bypassed in non-production.',
      provider: 'bypass',
      bypassed: true,
    };
  }

  const scanner = params.scanner ?? createSecurityScanProvider(params.env);
  const result = await scanner.scanBuffer({
    fileName: params.fileName,
    mimeType: params.mimeType,
    buffer: params.buffer,
    sha256Checksum: params.sha256Checksum,
  });

  if (result.verdict === 'CLEAN') {
    return {
      status: 'CLEAN',
      evidenceStatus: 'PROCESSING',
      completedAt: result.scannedAt,
      provider: result.provider,
    };
  }

  if (result.verdict === 'MALICIOUS') {
    return {
      status: 'MALICIOUS',
      evidenceStatus: 'SECURITY_REJECTED',
      completedAt: result.scannedAt,
      quarantineReason: result.reason ?? 'Malware/security policy rejected the binary.',
      provider: result.provider,
      signature: result.signature,
    };
  }

  return {
    status: 'FAILED',
    evidenceStatus: 'QUARANTINED',
    completedAt: result.scannedAt,
    quarantineReason: result.reason ?? 'Malware/security scan failed; evidence remains quarantined.',
    provider: result.provider,
  };
}
