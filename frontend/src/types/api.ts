export type ApiEnvelope<T> = {
  data: T;
  meta?: {
    requestId?: string;
    [key: string]: unknown;
  };
};

export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: Array<{ field?: string; reason?: string }>;
  };
};

export type MembershipRole = 'OWNER' | 'ADMIN' | 'COMPLIANCE_MANAGER' | 'MEMBER' | 'AUDITOR';
export type MembershipStatus = 'ACTIVE' | 'DISABLED' | 'REMOVED' | string;

export type AuthMembership = {
  id: string;
  companyId: string;
  companyName: string;
  role: MembershipRole;
  status: MembershipStatus;
};

export type CurrentUser = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerifiedAt: string | null;
  };
  memberships: AuthMembership[];
  session: {
    id: string;
    idleExpiresAt: string;
    absoluteExpiresAt: string;
  };
  csrfToken?: string;
};

export type CompanySummary = {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
};

export type FrameworkSummary = {
  id: string;
  name: string;
  description?: string | null;
  versions?: Array<{
    id: string;
    version: string;
    status: string;
    published_at?: string | null;
  }>;
  framework_versions?: Array<{
    id: string;
    version: string;
    status: string;
    published_at?: string | null;
  }>;
};

export type ReadinessStatus = 'CALCULABLE' | 'NOT_CALCULABLE';

export type DashboardOverview = {
  readinessStatus: ReadinessStatus;
  readinessPercent: number | null;
  applicableEvidenceBasedControls: number;
  readyControls: number;
  inProgressControls: number;
  notStartedControls: number;
  missingRequiredEvidence: number;
  overdueTasks: number | null;
  needsReview: number;
  evidenceVersionsNeedingReview: number;
  mappingsNeedingReview: number;
  expiringWithinDays: number;
  expiringWithinDaysCount: number;
  calculatedAt: string;
};

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ControlType = 'EVIDENCE_BASED' | 'INFORMATIONAL';
export type Applicability = 'APPLICABLE' | 'NOT_APPLICABLE';

export type EvidenceRequirement = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  requirement_type?: string | null;
  required: boolean;
  sort_order?: number;
};

export type CompanyControl = {
  id: string;
  applicability: Applicability;
  not_applicable_reason?: string | null;
  not_applicable_approved_by?: string | null;
  owner_user_id?: string | null;
  control?: {
    id: string;
    code: string;
    title: string;
    description?: string | null;
    risk_level: RiskLevel;
    control_type: ControlType;
    evidence_requirements?: EvidenceRequirement[];
  };
  company_framework?: {
    id: string;
    status: string;
  };
  coveragePercent?: number;
  satisfiedRequiredCount?: number;
  requiredCount?: number;
  readinessState?: string;
};

export type ControlProgressItem = CompanyControl & {
  companyControlId?: string;
  code?: string;
  title?: string;
  riskLevel?: RiskLevel;
  controlType?: ControlType;
  ownerUserId?: string | null;
  requiredCount?: number;
  satisfiedCount?: number;
  coveragePercent?: number;
  readinessState?: string;
  requirements?: Array<EvidenceRequirement & { satisfied?: boolean }>;
};

export type MissingEvidenceItem = {
  companyControlId: string;
  controlCode: string;
  controlTitle: string;
  requirementId: string;
  requirementCode: string;
  requirementName: string;
  riskLevel: RiskLevel;
  ownerUserId?: string | null;
};

export type EvidenceVersionStatus =
  | 'UPLOADED'
  | 'QUARANTINED'
  | 'SECURITY_REJECTED'
  | 'PROCESSING'
  | 'PROCESSING_FAILED'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export type SecurityScanStatus = 'NOT_REQUIRED' | 'PENDING' | 'CLEAN' | 'MALICIOUS' | 'FAILED';
export type SensitivityLevel = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type EvidenceVersion = {
  id: string;
  evidence_item_id?: string;
  version_no: number;
  storage_key?: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  sha256_checksum?: string;
  status: EvidenceVersionStatus;
  security_scan_status?: SecurityScanStatus;
  effective_from?: string | null;
  effective_until?: string | null;
  expiry_date?: string | null;
  created_at?: string;
  reviews?: Array<{
    id: string;
    decision: string;
    reason?: string | null;
    review_note?: string | null;
    created_at: string;
  }>;
};

export type EvidenceItem = {
  id: string;
  title: string;
  description?: string | null;
  sensitivity_level: SensitivityLevel;
  latest_version_id?: string | null;
  current_approved_version_id?: string | null;
  archived_at?: string | null;
  created_at?: string;
  latest_version?: EvidenceVersion | null;
  current_approved_version?: EvidenceVersion | null;
  versions?: EvidenceVersion[];
};

export type MappingSource = 'AI_SUGGESTED' | 'MANUAL';
export type MappingStatus = 'SUGGESTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export type EvidenceMapping = {
  id: string;
  source: MappingSource;
  status: MappingStatus;
  ai_confidence?: number | null;
  reason?: string | null;
  review_note?: string | null;
  control?: { id: string; code: string; title: string; risk_level?: RiskLevel; control_type?: ControlType };
  requirement?: { id: string; code: string; name: string; required?: boolean };
  mapped_by?: { id: string; name: string; email: string } | null;
  reviewed_by?: { id: string; name: string; email: string } | null;
  reviewed_at?: string | null;
  created_at?: string;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'SUBMITTED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskWorkflowSemantics = {
  taskCompletion: {
    status: TaskStatus;
    overdue: boolean;
    terminal: boolean;
    administrativeOnly: boolean;
    message: string;
  };
  evidenceReview: {
    scope: 'SEPARATE_EVIDENCE_WORKFLOW';
    status: string;
    submittedCount: number;
    approvedCount: number;
    needsReviewCount: number;
    rejectedOrBlockedCount: number;
    message: string;
  };
  mappingReview: {
    scope: 'SEPARATE_MAPPING_WORKFLOW';
    status: string;
    message: string;
  };
  boundary: {
    taskCompletionApprovesEvidence: false;
    taskCompletionApprovesMappings: false;
    evidenceReviewRoute: string;
    mappingReviewRoute: string;
  };
};

export type Task = {
  id: string;
  company_id?: string;
  company_control_id: string;
  requirement_id?: string | null;
  assigned_to_user_id?: string | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string | null;
  administrative_only?: boolean;
  cancelled_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  company_control?: {
    id: string;
    control: { id: string; code: string; title: string; risk_level: RiskLevel };
  };
  requirement?: { id: string; code: string; name: string; required: boolean } | null;
  assigned_to?: { id: string; name: string; email: string } | null;
  task_evidence?: Array<{
    id: string;
    evidence_version: EvidenceVersion & { evidence_item?: { id: string; title: string } };
    submitted_by?: { id: string; name: string; email: string } | null;
    created_at: string;
  }>;
  overdue?: boolean;
  taskCompletionStatus?: TaskStatus;
  evidenceReviewStatus?: string;
  mappingReviewStatus?: string;
  workflowSemantics?: TaskWorkflowSemantics;
};

export type CommentEntityType = 'TASK' | 'COMPANY_CONTROL' | 'EVIDENCE_ITEM' | 'EVIDENCE_VERSION';

export type Comment = {
  id: string;
  entity_type: CommentEntityType;
  entity_id: string;
  visibility: string;
  body: string;
  created_at: string;
  updated_at?: string;
  user?: { id: string; name: string; email: string } | null;
};

export type ReportType = 'AUDIT_READINESS' | 'MISSING_EVIDENCE' | 'CONTROL_COVERAGE' | 'EVIDENCE_INVENTORY';
export type ReportStatus = 'QUEUED' | 'GENERATING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type ReportFormat = 'JSON' | 'CSV';

export type ReportSummary = {
  id: string;
  type: ReportType;
  format: ReportFormat;
  schemaVersion: string;
  parameters: unknown;
  frameworkEnrollmentId?: string | null;
  frameworkVersionId?: string | null;
  status: ReportStatus;
  contentType?: string | null;
  fileName?: string | null;
  calculatedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  expiresAt?: string | null;
};

export type ReportListResponse = {
  items: ReportSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AiSettings = {
  enabled: boolean;
  allowRestrictedEvidence: boolean;
};

export type AiAnalysisStatus = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type AiAnalysis = {
  id: string;
  company_id?: string;
  evidence_version_id?: string;
  provider: string;
  model_name: string;
  prompt_version: string;
  schema_version?: string;
  input_hash?: string;
  status: AiAnalysisStatus;
  document_type?: string | null;
  structured_result_json?: unknown;
  summary?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  latency_ms?: number | null;
  token_usage_json?: unknown;
  created_at?: string;
  completed_at?: string | null;
};

export type AiAnalysisListResponse = {
  items: AiAnalysis[];
};

export type AiAnalysisRunResponse = {
  analysis: AiAnalysis;
  suggestedMappingCount: number;
};
