import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '../../shared/tenant-context.js';
import type { TaskListQuery } from './task.schemas.js';

export type Db = PrismaClient | Prisma.TransactionClient;

export class TasksRepository {
  constructor(private readonly prisma: Db) {}

  listTasksInTenantScope(params: { tenant: TenantContext; query: TaskListQuery; now: Date; restrictToAssignedUser?: boolean }) {
    const where: Prisma.TaskWhereInput = {
      company_id: params.tenant.companyId,
      ...(params.restrictToAssignedUser ? { assigned_to_user_id: params.tenant.userId } : {}),
      ...(params.query.status ? { status: params.query.status } : {}),
      ...(params.query.assignedToUserId ? { assigned_to_user_id: params.query.assignedToUserId } : {}),
      ...(params.query.companyControlId ? { company_control_id: params.query.companyControlId } : {}),
      ...(params.query.overdue === true
        ? { due_date: { lt: params.now }, status: { notIn: ['COMPLETED', 'CANCELLED'] } }
        : {}),
    };

    return this.prisma.task.findMany({
      where,
      orderBy: [{ due_date: 'asc' }, { created_at: 'desc' }],
      skip: (params.query.page - 1) * params.query.limit,
      take: params.query.limit,
      include: this.taskInclude(),
    });
  }

  findTaskInTenantScope(params: { tenant: TenantContext; taskId: string }) {
    return this.prisma.task.findFirst({
      where: { id: params.taskId, company_id: params.tenant.companyId },
      include: this.taskInclude(),
    });
  }

  findCompanyControlForTask(params: { tenant: TenantContext; companyControlId: string }) {
    return this.prisma.companyControl.findFirst({
      where: {
        id: params.companyControlId,
        company_framework: { company_id: params.tenant.companyId, status: 'ACTIVE' },
      },
      include: { control: { include: { evidence_requirements: true } } },
    });
  }

  findRequirementUnderCompanyControl(params: { companyControlId: string; requirementId: string }) {
    return this.prisma.evidenceRequirement.findFirst({
      where: {
        id: params.requirementId,
        control: { company_controls: { some: { id: params.companyControlId } } },
      },
    });
  }

  findActiveMemberInCompany(params: { companyId: string; userId: string }) {
    return this.prisma.companyMember.findFirst({
      where: { company_id: params.companyId, user_id: params.userId, status: 'ACTIVE' },
      select: { id: true, role: true, user_id: true },
    });
  }

  findEvidenceVersionInTenantScope(params: { tenant: TenantContext; evidenceVersionId: string }) {
    return this.prisma.evidenceVersion.findFirst({
      where: {
        id: params.evidenceVersionId,
        evidence_item: { company_id: params.tenant.companyId, archived_at: null },
      },
      include: { evidence_item: true },
    });
  }

  private taskInclude() {
    return {
      company_control: { select: { id: true, control: { select: { id: true, code: true, title: true, risk_level: true } } } },
      requirement: { select: { id: true, code: true, name: true, required: true } },
      assigned_to: { select: { id: true, name: true, email: true } },
      created_by: { select: { id: true, name: true, email: true } },
      task_evidence: {
        orderBy: { created_at: 'desc' as const },
        include: {
          evidence_version: {
            select: {
              id: true,
              version_no: true,
              file_name: true,
              status: true,
              evidence_item: { select: { id: true, title: true } },
            },
          },
          submitted_by: { select: { id: true, name: true, email: true } },
        },
      },
    } satisfies Prisma.TaskInclude;
  }
}
