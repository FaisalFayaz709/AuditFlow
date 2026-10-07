export type SecurityScanVerdict = 'CLEAN' | 'MALICIOUS' | 'FAILED';

export type SecurityScanInput = {
  fileName: string;
  mimeType?: string | undefined;
  buffer: Buffer;
  sha256Checksum: string;
};

export type SecurityScanResult = {
  verdict: SecurityScanVerdict;
  provider: string;
  scannedAt: Date;
  signature?: string | undefined;
  reason?: string | undefined;
};

export interface SecurityScanProvider {
  readonly name: string;
  scanBuffer(input: SecurityScanInput): Promise<SecurityScanResult>;
}

export const EICAR_TEST_MARKER = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
