import type { PrismaClient } from '@prisma/client';
import { AuditLogService } from '../audit-logs/audit-log.service.js';
import { AppError } from '../../shared/errors.js';
import { assertExactlyOneRowUpdated, assertNoConcurrentTerminalState } from '../../shared/concurrency.js';
import { hasPermission, requirePermission } from '../authz/permissions.js';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { CancelTaskBody, CompleteTaskBody, CreateTaskBody, RejectTaskBody, SubmitTaskEvidenceBody, TaskListQuery, UpdateTaskBody } from './task.schemas.js';
import { assertCanManageTasks, assertCanReadTask, assertCanReviewTasks, assertCanSubmitTask, assertTaskTransitionAllowed } from './task-policy.js';
import { buildTaskWorkflowSemantics, type TaskStatusValue } from './task-status-semantics.js';
import { TasksRepository } from './tasks.repository.js';

type AuditContext = {
  requestId: string;
  sessionId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
};

function auditBase(audit: AuditContext) {
  return {
    sessionId: audit.sessionId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    requestId: audit.requestId,
  };
}

export class TasksService {
  constructor(private readonly prisma: PrismaClient) {}

  async listTasks(params: { tenant: TenantContext; query: TaskListQuery }) {
    const restrictToAssignedUser = !hasPermission(params.tenant.role, 'tasks.read_all');
    if (restrictToAssignedUser) requirePermission(params.tenant, 'tasks.submit_assigned');
    const tasks = await new TasksRepository(this.prisma).listTasksInTenantScope({
      tenant: params.tenant,
      query: params.query,
      now: new Date(),
      restrictToAssignedUser,
    });
    return tasks.map((task) => this.decorateTask(task));
  }

  async getTask(params: { tenant: TenantContext; taskId: string }) {
    const task = await new TasksRepository(this.prisma).findTaskInTenantScope(params);
    if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
    assertCanReadTask({ tenant: params.tenant, assignedToUserId: task.assigned_to_user_id });
    return this.decorateTask(task);
  }

  async createTask(params: { tenant: TenantContext; body: CreateTaskBody; audit: AuditContext }) {
    assertCanManageTasks(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const companyControl = await repository.findCompanyControlForTask({ tenant: params.tenant, companyControlId: params.body.companyControlId });
      if (!companyControl) throw new AppError({ statusCode: 404, code: 'CONTROL_NOT_FOUND', message: 'Company control was not found.' });

      if (params.body.requirementId) {
        const requirement = await repository.findRequirementUnderCompanyControl({ companyControlId: params.body.companyControlId, requirementId: params.body.requirementId });
        if (!requirement) throw new AppError({ statusCode: 422, code: 'REQUIREMENT_NOT_ON_CONTROL', message: 'Requirement must belong to the selected control.' });
      }

      if (params.body.assignedToUserId) {
        const member = await repository.findActiveMemberInCompany({ companyId: params.tenant.companyId, userId: params.body.assignedToUserId });
        if (!member) throw new AppError({ statusCode: 422, code: 'ASSIGNEE_MUST_BE_ACTIVE_MEMBER', message: 'Task assignee must be an active company member.' });
      }

      const task = await tx.task.create({
        data: {
          company_id: params.tenant.companyId,
          company_control_id: params.body.companyControlId,
          requirement_id: params.body.requirementId,
          assigned_to_user_id: params.body.assignedToUserId,
          created_by_user_id: params.tenant.userId,
          title: params.body.title,
          description: params.body.description,
          priority: params.body.priority,
          due_date: params.body.dueDate,
          administrative_only: params.body.administrativeOnly,
        },
        include: { company_control: { select: { control: { select: { code: true } } } } },
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_CREATED',
        entityType: 'task',
        entityId: task.id,
        metadata: {
          title: task.title,
          companyControlId: task.company_control_id,
          controlCode: task.company_control.control.code,
          requirementId: task.requirement_id,
          assignedToUserId: task.assigned_to_user_id,
          dueDate: task.due_date,
        },
        actorSnapshot: { role: params.tenant.role },
      });

      if (task.assigned_to_user_id) {
        await new AuditLogService(tx).recordEvent({
          tenant: params.tenant,
          ...auditBase(params.audit),
          action: 'TASK_ASSIGNED',
          entityType: 'task',
          entityId: task.id,
          metadata: { assignedToUserId: task.assigned_to_user_id },
          actorSnapshot: { role: params.tenant.role },
        });
      }

      const created = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: task.id });
      if (!created) throw new AppError({ statusCode: 500, code: 'TASK_CREATE_READBACK_FAILED', message: 'Created task could not be read back.' });
      return this.decorateTask(created);
    });
  }

  async updateTask(params: { tenant: TenantContext; taskId: string; body: UpdateTaskBody; audit: AuditContext }) {
    assertCanManageTasks(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
        throw new AppError({ statusCode: 409, code: 'TASK_TERMINAL', message: 'Completed or cancelled tasks cannot be edited.' });
      }
      if (params.body.assignedToUserId) {
        const member = await repository.findActiveMemberInCompany({ companyId: params.tenant.companyId, userId: params.body.assignedToUserId });
        if (!member) throw new AppError({ statusCode: 422, code: 'ASSIGNEE_MUST_BE_ACTIVE_MEMBER', message: 'Task assignee must be an active company member.' });
      }

      const updateData = {
        ...(params.body.assignedToUserId !== undefined ? { assigned_to_user_id: params.body.assignedToUserId } : {}),
        ...(params.body.title !== undefined ? { title: params.body.title } : {}),
        ...(params.body.description !== undefined ? { description: params.body.description } : {}),
        ...(params.body.priority !== undefined ? { priority: params.body.priority } : {}),
        ...(params.body.dueDate !== undefined ? { due_date: params.body.dueDate } : {}),
      };
      assertExactlyOneRowUpdated(
        await tx.task.updateMany({
          where: { id: params.taskId, company_id: params.tenant.companyId, status: task.status, updated_at: task.updated_at },
          data: updateData,
        }),
        'Task changed before this update could be committed. Reload and retry.',
        [{ field: 'expectedUpdatedAt', reason: task.updated_at.toISOString() }],
      );
      const updated = await tx.task.findUniqueOrThrow({ where: { id: params.taskId } });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: task.assigned_to_user_id !== updated.assigned_to_user_id ? 'TASK_ASSIGNED' : 'TASK_UPDATED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: {
          before: { assignedToUserId: task.assigned_to_user_id, dueDate: task.due_date, title: task.title, priority: task.priority },
          after: { assignedToUserId: updated.assigned_to_user_id, dueDate: updated.due_date, title: updated.title, priority: updated.priority },
        },
        actorSnapshot: { role: params.tenant.role },
      });

      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_UPDATE_READBACK_FAILED', message: 'Updated task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  async startTask(params: { tenant: TenantContext; taskId: string; audit: AuditContext }) {
    return this.transitionTask({ tenant: params.tenant, taskId: params.taskId, nextStatus: 'IN_PROGRESS', audit: params.audit, submitPermission: true });
  }

  async submitEvidence(params: { tenant: TenantContext; taskId: string; body: SubmitTaskEvidenceBody; audit: AuditContext }) {
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      assertCanSubmitTask({ tenant: params.tenant, assignedToUserId: task.assigned_to_user_id });
      assertTaskTransitionAllowed({ current: task.status, next: 'SUBMITTED' });

      const evidenceVersion = await repository.findEvidenceVersionInTenantScope({ tenant: params.tenant, evidenceVersionId: params.body.evidenceVersionId });
      if (!evidenceVersion) throw new AppError({ statusCode: 404, code: 'EVIDENCE_VERSION_NOT_FOUND', message: 'Evidence version was not found.' });
      if (['SECURITY_REJECTED', 'QUARANTINED', 'ARCHIVED'].includes(evidenceVersion.status)) {
        throw new AppError({ statusCode: 422, code: 'EVIDENCE_VERSION_NOT_SUBMITTABLE', message: 'This evidence version cannot be submitted to a task.' });
      }

      await tx.taskEvidence.upsert({
        where: { task_id_evidence_version_id: { task_id: params.taskId, evidence_version_id: params.body.evidenceVersionId } },
        update: {},
        create: { task_id: params.taskId, evidence_version_id: params.body.evidenceVersionId, submitted_by_user_id: params.tenant.userId },
      });
      assertNoConcurrentTerminalState({
        count: (await tx.task.updateMany({ where: { id: params.taskId, company_id: params.tenant.companyId, status: task.status }, data: { status: 'SUBMITTED' } })).count,
        entity: 'Task',
        id: params.taskId,
        expectedState: task.status,
      });

      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_SUBMITTED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: { evidenceVersionId: params.body.evidenceVersionId },
        actorSnapshot: { role: params.tenant.role },
      });

      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_SUBMIT_READBACK_FAILED', message: 'Submitted task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  async completeTask(params: { tenant: TenantContext; taskId: string; body: CompleteTaskBody; audit: AuditContext }) {
    assertCanReviewTasks(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      assertTaskTransitionAllowed({ current: task.status, next: 'COMPLETED' });
      if (!task.administrative_only && task.task_evidence.length === 0) {
        throw new AppError({ statusCode: 422, code: 'TASK_EVIDENCE_REQUIRED', message: 'Task completion requires at least one submitted evidence version unless administrative_only is true.' });
      }

      assertNoConcurrentTerminalState({
        count: (await tx.task.updateMany({ where: { id: params.taskId, company_id: params.tenant.companyId, status: 'SUBMITTED' }, data: { status: 'COMPLETED', completed_at: new Date(), rejected_reason: null } })).count,
        entity: 'Task',
        id: params.taskId,
        expectedState: 'SUBMITTED',
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_COMPLETED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: { reviewNote: params.body.reviewNote, evidenceApprovalBypassed: false, mappingApprovalBypassed: false },
        actorSnapshot: { role: params.tenant.role },
      });
      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_COMPLETE_READBACK_FAILED', message: 'Completed task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  async rejectTask(params: { tenant: TenantContext; taskId: string; body: RejectTaskBody; audit: AuditContext }) {
    assertCanReviewTasks(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      assertTaskTransitionAllowed({ current: task.status, next: 'REJECTED' });
      assertNoConcurrentTerminalState({
        count: (await tx.task.updateMany({ where: { id: params.taskId, company_id: params.tenant.companyId, status: 'SUBMITTED' }, data: { status: 'REJECTED', rejected_reason: params.body.reason } })).count,
        entity: 'Task',
        id: params.taskId,
        expectedState: 'SUBMITTED',
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_REJECTED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: { reason: params.body.reason },
        actorSnapshot: { role: params.tenant.role },
      });
      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_REJECT_READBACK_FAILED', message: 'Rejected task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  async cancelTask(params: { tenant: TenantContext; taskId: string; body: CancelTaskBody; audit: AuditContext }) {
    assertCanManageTasks(params.tenant);
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      assertTaskTransitionAllowed({ current: task.status, next: 'CANCELLED' });
      assertNoConcurrentTerminalState({
        count: (await tx.task.updateMany({ where: { id: params.taskId, company_id: params.tenant.companyId, status: task.status }, data: { status: 'CANCELLED', cancelled_reason: params.body.reason } })).count,
        entity: 'Task',
        id: params.taskId,
        expectedState: task.status,
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_CANCELLED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: { reason: params.body.reason },
        actorSnapshot: { role: params.tenant.role },
      });
      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_CANCEL_READBACK_FAILED', message: 'Cancelled task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  private async transitionTask(params: { tenant: TenantContext; taskId: string; nextStatus: 'IN_PROGRESS'; audit: AuditContext; submitPermission?: boolean }) {
    return this.prisma.$transaction(async (tx) => {
      const repository = new TasksRepository(tx);
      const task = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!task) throw new AppError({ statusCode: 404, code: 'TASK_NOT_FOUND', message: 'Task was not found.' });
      if (params.submitPermission) assertCanSubmitTask({ tenant: params.tenant, assignedToUserId: task.assigned_to_user_id });
      assertTaskTransitionAllowed({ current: task.status, next: params.nextStatus });
      assertNoConcurrentTerminalState({
        count: (await tx.task.updateMany({ where: { id: params.taskId, company_id: params.tenant.companyId, status: task.status }, data: { status: params.nextStatus } })).count,
        entity: 'Task',
        id: params.taskId,
        expectedState: task.status,
      });
      await new AuditLogService(tx).recordEvent({
        tenant: params.tenant,
        ...auditBase(params.audit),
        action: 'TASK_STARTED',
        entityType: 'task',
        entityId: params.taskId,
        metadata: { from: task.status, to: params.nextStatus },
        actorSnapshot: { role: params.tenant.role },
      });
      const readback = await repository.findTaskInTenantScope({ tenant: params.tenant, taskId: params.taskId });
      if (!readback) throw new AppError({ statusCode: 500, code: 'TASK_START_READBACK_FAILED', message: 'Started task could not be read back.' });
      return this.decorateTask(readback);
    });
  }

  private decorateTask<T extends { status: string; due_date: Date | null; administrative_only?: boolean | null; task_evidence?: Array<{ evidence_version?: { status?: string | null } | null }> }>(task: T) {
    const workflow = buildTaskWorkflowSemantics({
      status: task.status as TaskStatusValue,
      dueDate: task.due_date,
      administrativeOnly: task.administrative_only,
      taskEvidence: task.task_evidence,
      now: new Date(),
    });
    return {
      ...task,
      overdue: workflow.taskCompletion.overdue,
      taskCompletionStatus: workflow.taskCompletion.status,
      evidenceReviewStatus: workflow.evidenceReview.status,
      mappingReviewStatus: workflow.mappingReview.status,
      workflowSemantics: workflow,
    };
  }
}
