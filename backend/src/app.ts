import Fastify from 'fastify';
import { loadEnv } from './config/env.js';
import { authSessionPlugin } from './plugins/auth-session.plugin.js';
import { corsPlugin } from './plugins/cors.plugin.js';
import { csrfPlugin } from './plugins/csrf.plugin.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { multipartPlugin } from './plugins/multipart.plugin.js';
import { prismaPlugin } from './plugins/prisma.plugin.js';
import { requestContextPlugin } from './plugins/request-context.plugin.js';
import { securityHeadersPlugin } from './plugins/security-headers.plugin.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { auditLogRoutes } from './modules/audit-logs/audit-log.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { companiesRoutes } from './modules/companies/companies.routes.js';
import { commentsRoutes } from './modules/comments/comments.routes.js';
import { controlsRoutes } from './modules/controls/controls.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { evidenceRoutes } from './modules/evidence/evidence.routes.js';
import { frameworksRoutes } from './modules/frameworks/frameworks.routes.js';
import { invitationsRoutes } from './modules/invitations/invitations.routes.js';
import { mappingsRoutes } from './modules/mappings/mappings.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { jobsRoutes } from './modules/jobs/jobs.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { auditorAccessRoutes } from './modules/auditor-access/auditor-access.routes.js';
import { retentionRoutes } from './modules/retention/retention.routes.js';
import { assertOperationalBootGate } from './shared/operational-gate.js';

export async function buildApp() {
  const env = loadEnv();
  assertOperationalBootGate(env);

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers.x-csrf-token',
        'password',
        'newPassword',
        'currentPassword',
        'token',
        'sessionToken',
        'csrfToken',
        'storage_key',
        'storageKey',
        'temporary_storage_key',
        'final_storage_key',
        'objectKey',
        'signedUrl',
        'signed_url',
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
        'providerMessageId',
        'notification.body',
        'delivery.last_error',
      ],
    },
  });

  await app.register(requestContextPlugin);
  await app.register(prismaPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(securityHeadersPlugin);
  await app.register(corsPlugin, { env });
  await app.register(multipartPlugin, { env });
  await app.register(authSessionPlugin, { env });
  await app.register(csrfPlugin, { env });

  await app.register(healthRoutes, { env });
  await app.register(authRoutes, { env });
  await app.register(companiesRoutes);
  await app.register(invitationsRoutes, { env });
  await app.register(frameworksRoutes);
  await app.register(controlsRoutes);
  await app.register(dashboardRoutes);
  await app.register(evidenceRoutes, { env });
  await app.register(mappingsRoutes);
  await app.register(tasksRoutes);
  await app.register(commentsRoutes);
  await app.register(reportsRoutes);
  await app.register(aiRoutes, { env });
  await app.register(jobsRoutes, { env });
  await app.register(notificationsRoutes, { env });
  await app.register(auditorAccessRoutes);
  await app.register(retentionRoutes);
  await app.register(auditLogRoutes);

  return { app, env };
}
