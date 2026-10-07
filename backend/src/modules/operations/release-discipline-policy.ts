export const PASS_58_CICD_RELEASE_DISCIPLINE_VERSION = 'cicd-release-discipline-v1.0-pass-58';

export type CiGateId =
  | 'locked_spec_static_audits'
  | 'integrated_locked_spec_audits'
  | 'openapi_generate'
  | 'prisma_validate_generate'
  | 'format_check'
  | 'lint'
  | 'typecheck'
  | 'unit_tests'
  | 'integration_tests'
  | 'api_contract_tests'
  | 'frontend_runtime_accessibility_tests'
  | 'tenant_rbac_security_tests'
  | 'ai_eval'
  | 'backend_frontend_build'
  | 'dependency_scan'
  | 'migration_validation'
  | 'staging_smoke_contract'
  | 'playwright_e2e';

export type ReleaseStepId =
  | 'approved_change'
  | 'strict_production_gate'
  | 'backup_verification'
  | 'controlled_migration'
  | 'backend_deploy'
  | 'health_ready_checks'
  | 'frontend_deploy'
  | 'critical_workflow_smoke_test'
  | 'release_audit_record';

export type MigrationDisciplineRule =
  | 'applied_production_migrations_are_immutable'
  | 'destructive_changes_use_expand_and_contract'
  | 'forward_corrective_migration_is_default_recovery'
  | 'backup_verification_precedes_production_migration'
  | 'migration_validation_runs_before_release'
  | 'release_stops_on_failed_migration_validation';

export const PASS_58_REQUIRED_CI_GATES: readonly CiGateId[] = [
  'locked_spec_static_audits',
  'integrated_locked_spec_audits',
  'openapi_generate',
  'prisma_validate_generate',
  'format_check',
  'lint',
  'typecheck',
  'unit_tests',
  'integration_tests',
  'api_contract_tests',
  'frontend_runtime_accessibility_tests',
  'tenant_rbac_security_tests',
  'ai_eval',
  'backend_frontend_build',
  'dependency_scan',
  'migration_validation',
  'staging_smoke_contract',
  'playwright_e2e',
] as const;

export const PASS_58_REQUIRED_RELEASE_SEQUENCE: readonly ReleaseStepId[] = [
  'approved_change',
  'strict_production_gate',
  'backup_verification',
  'controlled_migration',
  'backend_deploy',
  'health_ready_checks',
  'frontend_deploy',
  'critical_workflow_smoke_test',
  'release_audit_record',
] as const;

export const PASS_58_MIGRATION_DISCIPLINE_RULES: readonly MigrationDisciplineRule[] = [
  'applied_production_migrations_are_immutable',
  'destructive_changes_use_expand_and_contract',
  'forward_corrective_migration_is_default_recovery',
  'backup_verification_precedes_production_migration',
  'migration_validation_runs_before_release',
  'release_stops_on_failed_migration_validation',
] as const;

export const PASS_58_FORBIDDEN_RELEASE_DRIFT: readonly string[] = [
  'skip tests',
  'skip migration validation',
  'edit applied migration',
  'deploy frontend before backend health',
  'enable customer evidence before strict production gate',
  'rollback database without tested reversible migration',
] as const;

export type ReleaseDisciplineAuditMetadata = {
  runtimeVersion: typeof PASS_58_CICD_RELEASE_DISCIPLINE_VERSION;
  requiredCiGates: readonly CiGateId[];
  requiredReleaseSequence: readonly ReleaseStepId[];
  migrationDisciplineRules: readonly MigrationDisciplineRule[];
  packageManager: 'pnpm@9.12.0';
  lockedArchitecture: 'React+TypeScript+Vite Fastify+TypeScript PostgreSQL+Prisma modular-monolith';
  productionCustomerEvidenceGate: 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS';
};

function missingFrom<T extends string>(required: readonly T[], provided: readonly string[]): T[] {
  const providedSet = new Set(provided);
  return required.filter((item) => !providedSet.has(item));
}

export function buildReleaseDisciplineAuditMetadata(): ReleaseDisciplineAuditMetadata {
  return {
    runtimeVersion: PASS_58_CICD_RELEASE_DISCIPLINE_VERSION,
    requiredCiGates: PASS_58_REQUIRED_CI_GATES,
    requiredReleaseSequence: PASS_58_REQUIRED_RELEASE_SEQUENCE,
    migrationDisciplineRules: PASS_58_MIGRATION_DISCIPLINE_RULES,
    packageManager: 'pnpm@9.12.0',
    lockedArchitecture: 'React+TypeScript+Vite Fastify+TypeScript PostgreSQL+Prisma modular-monolith',
    productionCustomerEvidenceGate: 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS',
  };
}

export function assertPass58CiGateCoverage(providedGateIds: readonly string[]): void {
  const missing = missingFrom(PASS_58_REQUIRED_CI_GATES, providedGateIds);
  if (missing.length > 0) {
    throw new Error(`Pass 58 CI gate coverage missing: ${missing.join(', ')}`);
  }
}

export function assertPass58ReleaseSequence(providedStepIds: readonly string[]): void {
  const missing = missingFrom(PASS_58_REQUIRED_RELEASE_SEQUENCE, providedStepIds);
  if (missing.length > 0) {
    throw new Error(`Pass 58 release sequence missing: ${missing.join(', ')}`);
  }

  const positions = new Map(providedStepIds.map((stepId, index) => [stepId, index]));
  for (let index = 1; index < PASS_58_REQUIRED_RELEASE_SEQUENCE.length; index += 1) {
    const previous = PASS_58_REQUIRED_RELEASE_SEQUENCE[index - 1];
    const current = PASS_58_REQUIRED_RELEASE_SEQUENCE[index];
    if ((positions.get(previous) ?? Number.MAX_SAFE_INTEGER) > (positions.get(current) ?? -1)) {
      throw new Error(`Pass 58 release sequence order invalid: ${previous} must happen before ${current}`);
    }
  }
}

export function assertPass58MigrationDiscipline(providedRuleIds: readonly string[]): void {
  const missing = missingFrom(PASS_58_MIGRATION_DISCIPLINE_RULES, providedRuleIds);
  if (missing.length > 0) {
    throw new Error(`Pass 58 migration discipline missing: ${missing.join(', ')}`);
  }
}

export function assertPass58NoReleaseDrift(releaseNotes: string): void {
  const normalized = releaseNotes.toLowerCase();
  const drift = PASS_58_FORBIDDEN_RELEASE_DRIFT.filter((token) => normalized.includes(token));
  if (drift.length > 0) {
    throw new Error(`Pass 58 release drift phrase found: ${drift.join(', ')}`);
  }
}

export function assertPass58ReleaseDisciplineContract(): void {
  const metadata = buildReleaseDisciplineAuditMetadata();
  if (metadata.packageManager !== 'pnpm@9.12.0') {
    throw new Error('Pass 58 must retain pnpm@9.12.0 as the workspace package manager.');
  }
  if (metadata.productionCustomerEvidenceGate !== 'BLOCKED_UNTIL_STRICT_PRODUCTION_GATE_PASS') {
    throw new Error('Pass 58 must not enable customer evidence release.');
  }
  assertPass58CiGateCoverage(metadata.requiredCiGates);
  assertPass58ReleaseSequence(metadata.requiredReleaseSequence);
  assertPass58MigrationDiscipline(metadata.migrationDisciplineRules);
}
