import net from 'node:net';
import { type SecurityScanInput, type SecurityScanProvider, type SecurityScanResult } from './security-scan.types.js';

export type ClamAvScannerOptions = {
  host: string;
  port: number;
  timeoutMs: number;
};

function parseClamAvResponse(response: string, provider: string): SecurityScanResult {
  const scannedAt = new Date();
  const normalized = response.trim();

  if (normalized.endsWith('OK')) {
    return { verdict: 'CLEAN', provider, scannedAt };
  }

  if (normalized.includes('FOUND')) {
    return {
      verdict: 'MALICIOUS',
      provider,
      scannedAt,
      signature: normalized.replace(/^stream:\s*/i, '').replace(/\s+FOUND$/i, ''),
      reason: normalized,
    };
  }

  return {
    verdict: 'FAILED',
    provider,
    scannedAt,
    reason: normalized || 'ClamAV returned an empty or unrecognized response.',
  };
}

export class ClamAvScannerProvider implements SecurityScanProvider {
  readonly name = 'clamav';

  constructor(private readonly options: ClamAvScannerOptions) {}

  async scanBuffer(input: SecurityScanInput): Promise<SecurityScanResult> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: this.options.host, port: this.options.port });
      const chunks: Buffer[] = [];
      let settled = false;

      const finish = (result: SecurityScanResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(this.options.timeoutMs);

      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        const size = Buffer.alloc(4);
        size.writeUInt32BE(input.buffer.length, 0);
        socket.write(size);
        socket.write(input.buffer);
        socket.write(Buffer.alloc(4));
      });

      socket.on('data', (chunk) => chunks.push(chunk));
      socket.on('timeout', () => finish({ verdict: 'FAILED', provider: this.name, scannedAt: new Date(), reason: 'ClamAV scan timed out.' }));
      socket.on('error', (error) => finish({ verdict: 'FAILED', provider: this.name, scannedAt: new Date(), reason: error.message }));
      socket.on('end', () => finish(parseClamAvResponse(Buffer.concat(chunks).toString('utf8'), this.name)));
      socket.on('close', () => {
        if (!settled && chunks.length > 0) {
          finish(parseClamAvResponse(Buffer.concat(chunks).toString('utf8'), this.name));
        }
      });
    });
  }
}
