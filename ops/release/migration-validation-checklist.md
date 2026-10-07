# Migration Validation Checklist

Before release:

1. Run `pnpm db:validate`.
2. Run `pnpm ci:migration-validate`.
3. Confirm generated diff is explainable from committed Prisma schema and migrations.
4. Confirm applied production migrations are never edited.
5. Confirm destructive changes use expand-and-contract unless a tested reversible migration exists.
6. Confirm backup verification happens before production migration.
7. Confirm forward corrective migration plan exists for failure recovery.

The release must stop if migration validation or backup verification is incomplete.
