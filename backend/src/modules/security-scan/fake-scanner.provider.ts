import { EICAR_TEST_MARKER, type SecurityScanInput, type SecurityScanProvider, type SecurityScanResult } from './security-scan.types.js';

export class FakeSecurityScanProvider implements SecurityScanProvider {
  readonly name = 'fake';

  async scanBuffer(input: SecurityScanInput): Promise<SecurityScanResult> {
    if (input.buffer.includes(Buffer.from(EICAR_TEST_MARKER))) {
      return {
        verdict: 'MALICIOUS',
        provider: this.name,
        scannedAt: new Date(),
        signature: 'EICAR.TEST.MARKER',
        reason: 'EICAR test marker detected by fake scanner provider.',
      };
    }

    return {
      verdict: 'CLEAN',
      provider: this.name,
      scannedAt: new Date(),
    };
  }
}
