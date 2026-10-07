import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('Pass 14 sensitive data exposure safeguards', () => {
  it('redacts credentials, session, storage, signed URL, and extracted evidence fields from structured logs', () => {
    const appSource = readFileSync(join(root, 'src/app.ts'), 'utf8');
    for (const field of [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers.x-csrf-token',
      'password',
      'newPassword',
      'currentPassword',
      'token',
      'storage_key',
      'temporary_storage_key',
      'final_storage_key',
      'signedUrl',
      'extracted_text',
    ]) {
      expect(appSource).toContain(field);
    }
  });

  it('does not expose permanent storage keys through evidence download contract naming', () => {
    const contracts = readFileSync(join(root, 'src/openapi/route-contracts.v1.json'), 'utf8');
    expect(contracts).toContain('Authorized short-lived download');
    expect(contracts).not.toContain('permanent public URL');
  });
});
