import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => readFileSync(join(root, file), 'utf8');
const exists = (file) => existsSync(join(root, file));

for (const file of [
  'backend/src/shared/operational-gate.ts',
  'backend/src/config/env.ts',
  'backend/src/app.ts',
  'backend/test/operational-boot-gate.test.ts',
]) {
  if (!exists(file)) failures.push(`Missing ${file}`);
}

if (!failures.length) {
  const gate = read('backend/src/shared/operational-gate.ts');
  const env = read('backend/src/config/env.ts');
  const app = read('backend/src/app.ts');
  const cookies = read('backend/src/shared/http-cookies.ts');
  const csrfPlugin = read('backend/src/plugins/csrf.plugin.ts');
  const corsPlugin = read('backend/src/plugins/cors.plugin.ts');

  for (const token of [
    'collectOperationalGateFailures',
    'assertOperationalBootGate',
    'FRONTEND_ORIGIN',
    'SESSION_PEPPER',
    'STORAGE_DRIVER',
    'SECURITY_SCAN_MODE',
    'DATABASE_SSL_REQUIRED',
    'DATABASE_PITR_ENABLED',
    'SECRET_MANAGER_PROVIDER',
    'STRUCTURED_LOG_FORMAT',
    'LAST_RESTORE_TEST_STATUS',
    'READINESS_CHECK_DATABASE',
    'RELEASE_ID',
    'COMMIT_SHA',
  ]) if (!gate.includes(token)) failures.push(`Operational gate missing ${token}`);

  for (const token of [
    'STRUCTURED_LOG_FORMAT',
    'DATABASE_SSL_REQUIRED',
    'DATABASE_PITR_ENABLED',
    'SECRET_MANAGER_PROVIDER',
    'LAST_RESTORE_TEST_STATUS',
    'validateOperationalGateConfiguration',
    'collectOperationalGateFailures',
  ]) if (!env.includes(token)) failures.push(`env.ts missing ${token}`);

  if (!app.includes('assertOperationalBootGate(env)')) failures.push('buildApp must call assertOperationalBootGate(env).');
  if (!cookies.includes("'HttpOnly'") || !cookies.includes('SESSION_COOKIE_DEFAULT_SAMESITE') || !cookies.includes("'Secure'")) failures.push('Session cookie helper must preserve HttpOnly, SameSite=Lax, and Secure in elevated environments.');
  if (!csrfPlugin.includes('validateCsrfToken')) failures.push('CSRF plugin must validate state-changing authenticated requests.');
  if (!corsPlugin.includes('credentials: true') || !corsPlugin.includes('FRONTEND_ORIGIN')) failures.push('CORS must use explicit FRONTEND_ORIGIN with credentials.');
}

if (failures.length) {
  console.error('Operational runtime gate verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Operational runtime gate verification passed: elevated environment boot checks, secure cookies, explicit CORS, CSRF, storage, scanner, database, secret manager, release metadata, and restore gates are wired.');
