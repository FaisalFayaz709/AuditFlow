import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict') || process.env.PRODUCTION_GATE_STRICT === 'true';
const failures = [];
const read = (file) => readFileSync(join(root, file), 'utf8');
const exists = (file) => existsSync(join(root, file));
const manifestPath = 'docs/production-gates/production-gate-evidence.manifest.json';

const requiredArtifacts = [
  'docs/production-gates/security-review.md',
  'docs/production-gates/cross-tenant-test-results.md',
  'docs/production-gates/files-storage-security.md',
  'docs/production-gates/backup-restore-test.md',
  'docs/production-gates/observability-checks.md',
  'docs/production-gates/privacy-retention-ai-provider.md',
  'docs/production-gates/load-test-results.md',
  'docs/production-gates/accessibility-checklist.md',
  'docs/production-gates/operations-release-support.md',
  'docs/production-gates/incident-runbooks.md',
  manifestPath,
];

for (const file of requiredArtifacts) {
  if (!exists(file)) failures.push(`Missing required production gate artifact: ${file}`);
}

if (!failures.length) {
  const manifest = JSON.parse(read(manifestPath));
  const areas = new Map(manifest.requiredAreas.map((entry) => [entry.area, entry]));
  for (const area of ['security', 'files', 'recovery', 'observability', 'privacy', 'performance', 'accessibility', 'operations']) {
    const entry = areas.get(area);
    if (!entry) failures.push(`Manifest missing required area: ${area}`);
    else {
      if (!exists(entry.artifact)) failures.push(`Manifest artifact for ${area} does not exist: ${entry.artifact}`);
      if (!Array.isArray(entry.requiredEvidence) || entry.requiredEvidence.length === 0) failures.push(`${area} must list required evidence items.`);
      if (strict && entry.status !== 'APPROVED') failures.push(`${area} status must be APPROVED in strict mode.`);
    }
  }

  if (manifest.approvalRequiredBeforeCustomerEvidence !== true) failures.push('approvalRequiredBeforeCustomerEvidence must remain true.');
  if (manifest.customerEvidenceAllowed === true && manifest.gateStatus !== 'APPROVED') failures.push('customerEvidenceAllowed cannot be true unless gateStatus is APPROVED.');
  if (strict && manifest.gateStatus !== 'APPROVED') failures.push('gateStatus must be APPROVED in strict mode.');

  const incidentRunbooks = read('docs/production-gates/incident-runbooks.md').toLowerCase();
  for (const token of [
    'suspected cross-tenant access',
    'malware upload',
    'database outage',
    'object storage outage',
    'ai provider outage',
    'worker/redis outage',
    'credential leak',
    'failed migration',
  ]) {
    if (!incidentRunbooks.includes(token)) failures.push(`Incident runbooks missing ${token}`);
  }

  const requiredContent = {
    'docs/production-gates/security-review.md': ['threat review', 'cross-tenant', 'IDOR', 'CSRF', 'upload validation', 'dependency scan', 'secret rotation'],
    'docs/production-gates/files-storage-security.md': ['private encrypted storage', 'malware scanning', 'object reconciliation', 'download authorization'],
    'docs/production-gates/backup-restore-test.md': ['PITR', 'restore test', 'RPO', 'RTO'],
    'docs/production-gates/observability-checks.md': ['request IDs', 'structured redacted logs', 'error tracking', 'uptime checks', 'alerts'],
    'docs/production-gates/privacy-retention-ai-provider.md': ['retention/deletion', 'DPA', 'subprocessor', 'AI provider', 'incident notification'],
    'docs/production-gates/load-test-results.md': ['p95', '500ms', 'representative load test'],
    'docs/production-gates/accessibility-checklist.md': ['keyboard', 'semantic forms', 'semantic tables', 'non-color status cues'],
    'docs/production-gates/operations-release-support.md': ['staging environment', 'CI/CD', 'migration/release checklist', 'support escalation owner'],
  };
  for (const [file, tokens] of Object.entries(requiredContent)) {
    const text = read(file).toLowerCase();
    for (const token of tokens) {
      if (!text.includes(token.toLowerCase())) failures.push(`${file} missing content token: ${token}`);
    }
  }
}

if (failures.length) {
  console.error(`Production non-functional gate verification failed (${strict ? 'strict' : 'source'} mode):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production non-functional gate verification passed in ${strict ? 'strict' : 'source'} mode.`);
