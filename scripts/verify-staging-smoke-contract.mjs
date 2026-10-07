import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => readFileSync(join(root, file), 'utf8');
const requiredFiles = [
  'ops/release/staging-smoke-test-checklist.md',
  'ops/release/release-audit-record-template.md',
  'ops/release/migration-validation-checklist.md',
  'docs/CI_CD_RELEASE_CHECKLIST.md',
  'docs/DEPLOYMENT_RUNBOOK.md',
  'playwright.config.ts',
  'frontend/src/e2e/critical-workflow-smoke.spec.ts',
];
for (const file of requiredFiles) if (!existsSync(join(root, file))) failures.push(`Missing ${file}`);

if (!failures.length) {
  const smoke = read('ops/release/staging-smoke-test-checklist.md');
  const release = read('ops/release/release-audit-record-template.md');
  const deploy = read('docs/DEPLOYMENT_RUNBOOK.md');
  const ci = read('.github/workflows/ci.yml');
  const releaseWorkflow = read('.github/workflows/release.yml');
  for (const token of ['/health', '/ready', 'register/login', 'enable framework', 'upload evidence', 'approve evidence', 'approve mapping', 'readiness trace', 'generate report', 'auditor grant']) {
    if (!smoke.toLowerCase().includes(token.toLowerCase())) failures.push(`Smoke checklist missing ${token}`);
  }
  for (const token of ['approved change', 'backup verification', 'controlled migration', 'backend deploy', 'frontend deploy', 'critical workflow smoke test', 'release audit record']) {
    if (!release.toLowerCase().includes(token)) failures.push(`Release audit template missing ${token}`);
    if (!releaseWorkflow.toLowerCase().includes(token)) failures.push(`Release workflow missing ${token}`);
  }
  if (!deploy.includes('/health') || !deploy.includes('/ready')) failures.push('Deployment runbook must include /health and /ready smoke checks.');
  if (!ci.includes('Staging smoke contract')) failures.push('CI workflow missing staging smoke contract step.');
}

if (failures.length) {
  console.error('Staging smoke/release contract verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Staging smoke and release contract verification passed. Real staging deployment smoke still requires environment-specific execution.');
