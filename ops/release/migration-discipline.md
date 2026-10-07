# Migration Discipline

## Required rules

- `applied_production_migrations_are_immutable`
- `destructive_changes_use_expand_and_contract`
- `forward_corrective_migration_is_default_recovery`
- `backup_verification_precedes_production_migration`
- `migration_validation_runs_before_release`
- `release_stops_on_failed_migration_validation`

## Operational standard

1. Every schema change is represented by a reviewed Prisma migration.
2. Production deployments apply migrations as a controlled release step.
3. Destructive column/table removal uses expand-and-contract: add new shape, backfill, switch application, then remove later.
4. Already-applied production migrations are never edited.
5. Failed database release recovery uses a tested forward corrective migration unless a tested reversible migration exists.
6. Backup verification and restore-test status are checked before production migration.

The release must stop if migration validation, backup verification, or restore-test evidence is incomplete.
