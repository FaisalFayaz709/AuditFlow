import { PrismaClient } from '@prisma/client';
import { loadEnv } from '../../config/env.js';
import { createAuditFlowWorker } from './job-queue.js';
import { JobsService } from './jobs.service.js';

export async function startAuditFlowWorker() {
  const env = loadEnv();
  if (!env.JOBS_ENABLED) {
    throw new Error('JOBS_ENABLED must be true before starting the background worker.');
  }
  const prisma = new PrismaClient();
  const service = new JobsService(prisma, env);
  const worker = createAuditFlowWorker(env, (payload) => service.processPayload(payload));
  worker.on('failed', (job, error) => {
    console.error({ jobId: job?.id, jobName: job?.name, error: error.message }, 'AuditFlow background job failed');
  });
  worker.on('completed', (job) => {
    console.info({ jobId: job.id, jobName: job.name }, 'AuditFlow background job completed');
  });
  await worker.run();
  return { worker, prisma };
}
