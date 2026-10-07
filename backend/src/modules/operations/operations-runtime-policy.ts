export const PASS_57_OPERATIONS_RECOVERY_RUNTIME_VERSION = 'observability-backup-recovery-incident-runtime-v1.0-pass-57';

export type OperationalAlertId =
  | 'repeated_5xx'
  | 'readiness_not_ready'
  | 'login_abuse'
  | 'worker_failure'
  | 'storage_failure'
  | 'database_connectivity'
  | 'backup_failure'
  | 'restore_test_due'
  | 'storage_database_reconciliation_failure';

export type IncidentRunbookId =
  | 'suspected_cross_tenant_access'
  | 'malware_upload'
  | 'database_outage'
  | 'object_storage_outage'
  | 'ai_provider_outage'
  | 'worker_redis_outage'
  | 'credential_leak'
  | 'failed_migration';

export const PASS_57_REQUIRED_OPERATIONAL_ALERTS: readonly OperationalAlertId[] = [
  'repeated_5xx',
  'readiness_not_ready',
  'login_abuse',
  'worker_failure',
  'storage_failure',
  'database_connectivity',
  'backup_failure',
  'restore_test_due',
  'storage_database_reconciliation_failure',
] as const;

export const PASS_57_REQUIRED_INCIDENT_RUNBOOKS: readonly IncidentRunbookId[] = [
  'suspected_cross_tenant_access',
  'malware_upload',
  'database_outage',
  'object_storage_outage',
  'ai_provider_outage',
  'worker_redis_outage',
  'credential_leak',
  'failed_migration',
] as const;

export const PASS_57_FORBIDDEN_LOG_FIELD_MARKERS: readonly string[] = [
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'sessionToken',
  'csrfToken',
  'x-csrf-token',
  'cookie',
  'authorization',
  'signedUrl',
  'signed_url',
  'storage_key',
  'storageKey',
  'temporary_storage_key',
  'final_storage_key',
  'objectKey',
  'extracted_text',
  'evidenceText',
  'fullEvidenceText',
  'structured_result_json',
  'untrustedDocumentText',
  'prompt',
  'aiPrompt',
  'aiInput',
  'aiOutput',
  'providerSecret',
] as const;

export const PASS_57_RESTORE_TEST_REQUIRED_CHECKS: readonly string[] = [
  '/health',
  '/ready',
  'login',
  'evidence metadata read',
  'authorized download check',
  'report regeneration check',
  'database object reference consistency',
] as const;

export type RestoreTestRecord = {
  environment: 'staging' | 'production' | 'production-equivalent';
  result: 'PASS' | 'FAIL';
  operator: string;
  backupSource: string;
  restoreTarget: string;
  checkedItems: readonly string[];
  auditEvent: 'RESTORE_TEST_COMPLETED';
};

export type OperationsRecoveryAuditMetadata = {
  runtimeVersion: typeof PASS_57_OPERATIONS_RECOVERY_RUNTIME_VERSION;
  requestIdsEnabled: true;
  structuredRedactedLogs: true;
  healthEndpoint: '/health';
  readinessEndpoint: '/ready';
  alertRules: readonly OperationalAlertId[];
  incidentRunbooks: readonly IncidentRunbookId[];
  backupRestoreRecordRequired: true;
  restoreAuditEvent: 'RESTORE_TEST_COMPLETED';
  customerEvidenceRelease: 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS';
};

export function buildOperationsRecoveryAuditMetadata(): OperationsRecoveryAuditMetadata {
  return {
    runtimeVersion: PASS_57_OPERATIONS_RECOVERY_RUNTIME_VERSION,
    requestIdsEnabled: true,
    structuredRedactedLogs: true,
    healthEndpoint: '/health',
    readinessEndpoint: '/ready',
    alertRules: PASS_57_REQUIRED_OPERATIONAL_ALERTS,
    incidentRunbooks: PASS_57_REQUIRED_INCIDENT_RUNBOOKS,
    backupRestoreRecordRequired: true,
    restoreAuditEvent: 'RESTORE_TEST_COMPLETED',
    customerEvidenceRelease: 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS',
  };
}

export function assertPass57RedactionCoverage(redactedPaths: readonly string[]): void {
  const normalized = redactedPaths.map((item) => item.toLowerCase());
  const missing = PASS_57_FORBIDDEN_LOG_FIELD_MARKERS.filter((marker) => {
    const loweredMarker = marker.toLowerCase();
    return !normalized.some((path) => path.includes(loweredMarker));
  });

  if (missing.length > 0) {
    throw new Error(`Pass 57 redacted structured log coverage missing: ${missing.join(', ')}`);
  }
}

export function assertPass57IncidentRunbooks(runbookIds: readonly string[]): void {
  const provided = new Set(runbookIds);
  const missing = PASS_57_REQUIRED_INCIDENT_RUNBOOKS.filter((runbookId) => !provided.has(runbookId));
  if (missing.length > 0) {
    throw new Error(`Pass 57 incident runbook coverage missing: ${missing.join(', ')}`);
  }
}

export function assertRestoreTestRecord(record: RestoreTestRecord): void {
  if (record.result !== 'PASS') throw new Error('Restore test record must be PASS before customer evidence release.');
  if (record.auditEvent !== 'RESTORE_TEST_COMPLETED') throw new Error('Restore test record must emit RESTORE_TEST_COMPLETED.');
  if (!record.operator.trim() || !record.backupSource.trim() || !record.restoreTarget.trim()) {
    throw new Error('Restore test record requires operator, backup source, and restore target.');
  }

  const checked = new Set(record.checkedItems);
  const missing = PASS_57_RESTORE_TEST_REQUIRED_CHECKS.filter((item) => !checked.has(item));
  if (missing.length > 0) {
    throw new Error(`Restore test record missing required checks: ${missing.join(', ')}`);
  }
}

export function assertPass57OperationsRuntimeContract(): void {
  const metadata = buildOperationsRecoveryAuditMetadata();
  if (metadata.alertRules.length !== PASS_57_REQUIRED_OPERATIONAL_ALERTS.length) {
    throw new Error('Pass 57 operational alert rule count drifted.');
  }
  if (metadata.incidentRunbooks.length !== PASS_57_REQUIRED_INCIDENT_RUNBOOKS.length) {
    throw new Error('Pass 57 incident runbook count drifted.');
  }
  if (metadata.customerEvidenceRelease !== 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS') {
    throw new Error('Pass 57 must not enable customer evidence release.');
  }
}
