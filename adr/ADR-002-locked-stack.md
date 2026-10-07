# ADR-002: Lock Technology Stack

Status: Accepted

## Decision

Use the locked AuditFlow stack:

| Layer | Decision |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Object storage | Local dev storage; S3/R2/MinIO-compatible production path |
| Auth | Opaque server-side sessions in HttpOnly cookies |
| Validation | Fastify JSON Schema and/or Zod at service boundaries |
| AI | Provider adapter with structured JSON outputs |
| Jobs | BullMQ + Redis after core workflow |
| Testing | Vitest/Jest + Supertest + Playwright |

## Rationale

The stack supports typed SaaS development, relational integrity, secure file metadata modeling, modular backend code, and testable domain services without infrastructure sprawl.

## Non-Goals

Do not replace the stack for preference or novelty during the first 16-week build unless a blocking technical problem is proven and documented.
