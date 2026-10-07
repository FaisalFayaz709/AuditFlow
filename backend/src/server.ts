import { buildApp } from './app.js';

const { app, env } = await buildApp();

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info({ port: env.PORT, host: env.HOST }, 'AuditFlow backend started');
} catch (error) {
  app.log.error({ err: error }, 'Failed to start AuditFlow backend');
  process.exit(1);
}
