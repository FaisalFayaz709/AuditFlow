# Locked Stack and Architecture Rules

AuditFlow uses the following locked stack for the initial implementation:

| Layer | Decision |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Fastify + TypeScript |
| Database | PostgreSQL |
| ORM / migrations | Prisma |
| Auth | Opaque server-side session token in HttpOnly cookie plus CSRF |
| File storage | Private local dev storage; S3/R2/MinIO-compatible object storage for production |
| AI | Provider adapter, structured JSON output, human review |
| Background jobs | BullMQ + Redis after the core workflow |
| Deployment | Managed frontend, Node backend, managed PostgreSQL, private object storage |

Architecture remains a modular monolith. Internal modules may be separated by domain, but the backend is one deployable Fastify application.
