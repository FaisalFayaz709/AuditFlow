# CI/CD Gate Map

Status: `SOURCE_CICD_RELEASE_DISCIPLINE_GATE_PREPARED_RUNTIME_PENDING`

| Gate ID | Required command or evidence |
|---|---|
| openapi_generate | `pnpm openapi:generate` |
| prisma_validate_generate | `pnpm db:validate` and `pnpm db:generate` |
| format_check | `pnpm format:check` |
| lint | `pnpm lint` |
| typecheck | `pnpm typecheck` |
| unit_tests | `pnpm test:unit` |
| integration_tests | `pnpm test:integration` |
| api_contract_tests | `pnpm test:contracts` and `pnpm test:api-contract-completion` |
| frontend_runtime_accessibility_tests | `pnpm test:frontend-runtime` |
| tenant_rbac_security_tests | `pnpm test:security` and `pnpm test:security-acceptance` |
| ai_eval | `pnpm test:ai-runtime` and `pnpm ai:eval` |
| backend_frontend_build | `pnpm build` |
| dependency_scan | `pnpm ci:dependency-scan` |
| migration_validation | `pnpm ci:migration-validate` |
| staging_smoke_contract | `pnpm ci:staging-smoke-contract` |
| playwright_e2e | `pnpm test:e2e` |

No gate may be skipped to accelerate release. Production release requires a committed `pnpm-lock.yaml` and `pnpm install --frozen-lockfile`.
