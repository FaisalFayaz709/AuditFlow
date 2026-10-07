import { Queue, QueueEvents, Worker, type JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import type { AppEnv } from '../../config/env.js';
import type { AuditFlowJobPayload } from './job-types.js';

export const AUDITFLOW_QUEUE_NAME = 'auditflow-background-jobs';

export function createRedisConnection(env: Pick<AppEnv, 'REDIS_URL'>) {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function defaultJobOptions(env: Pick<AppEnv, 'JOB_REMOVE_ON_COMPLETE_COUNT' | 'JOB_REMOVE_ON_FAIL_COUNT'>): JobsOptions {
  return {
    attempts: 5,
    backoff: { type: 'exponential', delay: 15_000 },
    removeOnComplete: { count: env.JOB_REMOVE_ON_COMPLETE_COUNT },
    removeOnFail: { count: env.JOB_REMOVE_ON_FAIL_COUNT },
  };
}

export function createAuditFlowQueue(env: AppEnv) {
  const connection = createRedisConnection(env);
  return new Queue<AuditFlowJobPayload>(AUDITFLOW_QUEUE_NAME, {
    connection,
    defaultJobOptions: defaultJobOptions(env),
  });
}

export function createAuditFlowQueueEvents(env: AppEnv) {
  return new QueueEvents(AUDITFLOW_QUEUE_NAME, { connection: createRedisConnection(env) });
}

export function createAuditFlowWorker(env: AppEnv, processor: (payload: AuditFlowJobPayload) => Promise<unknown>) {
  return new Worker<AuditFlowJobPayload>(
    AUDITFLOW_QUEUE_NAME,
    async (job) => processor(job.data),
    {
      connection: createRedisConnection(env),
      concurrency: env.JOB_WORKER_CONCURRENCY,
      autorun: false,
    },
  );
}
