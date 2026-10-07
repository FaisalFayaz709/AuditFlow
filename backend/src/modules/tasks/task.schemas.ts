import { z } from 'zod';

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'REJECTED', 'CANCELLED']);
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

const OptionalDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return new Date(String(value));
}, z.date().optional());

export const TaskIdParamsSchema = z.object({ id: z.string().min(1) });

export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  assignedToUserId: z.string().min(1).optional(),
  companyControlId: z.string().min(1).optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const CreateTaskBodySchema = z.object({
  companyControlId: z.string().min(1),
  requirementId: z.string().min(1).optional(),
  assignedToUserId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: TaskPrioritySchema.default('MEDIUM'),
  dueDate: OptionalDateSchema,
  administrativeOnly: z.boolean().default(false),
});

export const UpdateTaskBodySchema = z.object({
  assignedToUserId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: TaskPrioritySchema.optional(),
  dueDate: OptionalDateSchema.nullable().optional(),
});

export const SubmitTaskEvidenceBodySchema = z.object({
  evidenceVersionId: z.string().min(1),
});

export const CompleteTaskBodySchema = z.object({
  reviewNote: z.string().trim().max(2000).optional(),
});

export const RejectTaskBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const CancelTaskBodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
export type CreateTaskBody = z.infer<typeof CreateTaskBodySchema>;
export type UpdateTaskBody = z.infer<typeof UpdateTaskBodySchema>;
export type SubmitTaskEvidenceBody = z.infer<typeof SubmitTaskEvidenceBodySchema>;
export type CompleteTaskBody = z.infer<typeof CompleteTaskBodySchema>;
export type RejectTaskBody = z.infer<typeof RejectTaskBodySchema>;
export type CancelTaskBody = z.infer<typeof CancelTaskBodySchema>;
