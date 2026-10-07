import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'docs/DEPLOYMENT_RUNBOOK.md',
  'docs/CI_CD_RELEASE_CHECKLIST.md',
  'docs/BACKUP_RESTORE_RUNBOOK.md',
  'docs/OBSERVABILITY_LOGGING.md',
  'docs/PRODUCTION_ENVIRONMENT_MATRIX.md',
  'ops/backup/restore-test-record-template.md',
  'ops/monitoring/alert-rules.md',
  'ops/support/support-escalation-owner.md',
  'ops/accessibility/accessibility-audit-checklist.md',
  'ops/performance/load-test-plan.md',
  'ops/privacy/privacy-dpa-subprocessor-checklist.md',
  'ops/security/threat-review-template.md',
  'ops/go-live/customer-evidence-gate-record.md',
  'docs/PRODUCTION_NON_FUNCTIONAL_GATE.md',
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length) {
  console.error(`Release readiness check failed. Missing files:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

const envExample = readFileSync('.env.example', 'utf8');
for (const key of ['APP_VERSION', 'RELEASE_ID', 'COMMIT_SHA', 'READINESS_CHECK_DATABASE', 'BACKUP_POLICY_NAME', 'CUSTOMER_EVIDENCE_ENABLED', 'PRODUCTION_GATE_STATUS', 'PRODUCTION_GATE_APPROVAL_REFERENCE']) {
  if (!envExample.includes(key)) {
    console.error(`Release readiness check failed. Missing .env.example key: ${key}`);
    process.exit(1);
  }
}

console.log('Release readiness source artifacts are present. Runtime smoke tests must still be run in staging.');
