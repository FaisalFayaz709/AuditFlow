import { z } from 'zod';

export const MaintenanceJobTypeSchema = z.enum([
  'EXPIRE_EVIDENCE',
  'SEND_EXPIRY_ALERT',
  'SEND_TASK_REMINDER',
  'CLEANUP_TEMP_UPLOADS',
  'RECONCILE_STORAGE_OBJECT',
  'PURGE_APPROVED_DELETION_REQUESTS',
  'DELIVER_NOTIFICATIONS',
]);

export const RunMaintenanceJobBodySchema = z.object({
  type: MaintenanceJobTypeSchema,
});

export type RunMaintenanceJobBody = z.infer<typeof RunMaintenanceJobBodySchema>;
