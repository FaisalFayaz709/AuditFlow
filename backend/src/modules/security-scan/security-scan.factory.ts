import type { AppEnv } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import { ClamAvScannerProvider } from './clamav-scanner.provider.js';
import { FakeSecurityScanProvider } from './fake-scanner.provider.js';
import type { SecurityScanProvider } from './security-scan.types.js';

export function createSecurityScanProvider(env: AppEnv): SecurityScanProvider {
  if (env.SECURITY_SCAN_PROVIDER === 'fake') {
    if (env.NODE_ENV === 'staging' || env.NODE_ENV === 'production') {
      throw new AppError({
        statusCode: 500,
        code: 'REAL_SECURITY_SCANNER_REQUIRED',
        message: 'Staging and production evidence workflows require a real malware/security scanner provider.',
      });
    }
    return new FakeSecurityScanProvider();
  }

  if (env.SECURITY_SCAN_PROVIDER === 'clamav') {
    return new ClamAvScannerProvider({
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
      timeoutMs: env.CLAMAV_TIMEOUT_MS,
    });
  }

  throw new AppError({
    statusCode: 500,
    code: 'SECURITY_SCAN_PROVIDER_UNSUPPORTED',
    message: `Unsupported security scan provider: ${env.SECURITY_SCAN_PROVIDER}`,
  });
}
