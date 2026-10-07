import { apiClient } from '../../lib/api-client';
import type { ControlProgressItem, DashboardOverview, EvidenceItem, MissingEvidenceItem, Task } from '../../types/api';

export function getDashboardOverview(companyId: string) {
  return apiClient.get<DashboardOverview>('/api/dashboard/overview', { companyId });
}

export function getControlProgress(companyId: string) {
  return apiClient.get<{ items?: ControlProgressItem[]; controlCoverage?: ControlProgressItem[] }>('/api/dashboard/control-progress', { companyId });
}

export function getMissingEvidence(companyId: string) {
  return apiClient.get<{ items: MissingEvidenceItem[]; missingRequiredEvidence?: number }>('/api/dashboard/missing-evidence', { companyId });
}

export function getExpiringEvidence(companyId: string) {
  return apiClient.get<{ items: EvidenceItem[]; expiringWithinDays: number }>('/api/dashboard/expiring-evidence', { companyId });
}

export function getOverdueTasks(companyId: string) {
  return apiClient.get<{ items: Task[]; calculatedAt: string }>('/api/dashboard/overdue-tasks', { companyId });
}


export type ReadinessTraceResponse = {
  readinessStatus: 'CALCULABLE' | 'NOT_CALCULABLE';
  readinessPercent: number | null;
  aiConfidenceUsed: false;
  controls: Array<{
    companyControlId: string;
    code: string;
    title: string;
    controlType: string;
    applicability: string;
    eligible: boolean;
    exclusionReason?: string | null;
    riskWeight: number;
    requiredCount: number;
    satisfiedCount: number;
    requirements: Array<{
      requirementId: string;
      code: string;
      name: string;
      required: boolean;
      satisfied: boolean;
      approvedMappingIds: string[];
      satisfyingEvidenceVersionIds: string[];
      explanation: string;
    }>;
  }>;
};

export function getReadinessTrace(companyId: string) {
  return apiClient.get<ReadinessTraceResponse>('/api/dashboard/readiness-trace', { companyId });
}
