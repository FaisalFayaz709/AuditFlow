# Canonical Enums

These enums are locked for initial implementation unless changed by a later accepted ADR that remains compliant with the specification.

## User and Membership

```ts
export enum UserStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

export enum CompanyMemberRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  COMPLIANCE_MANAGER = "COMPLIANCE_MANAGER",
  MEMBER = "MEMBER",
  AUDITOR = "AUDITOR",
}

export enum CompanyMemberStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
  REMOVED = "REMOVED",
}
```

## Frameworks and Controls

```ts
export enum FrameworkVersionStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  ARCHIVED = "ARCHIVED",
}

export enum CompanyFrameworkStatus {
  DRAFT_RECONCILIATION = "DRAFT_RECONCILIATION",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
}

export enum ControlType {
  EVIDENCE_BASED = "EVIDENCE_BASED",
  INFORMATIONAL = "INFORMATIONAL",
}

export enum ControlApplicability {
  APPLICABLE = "APPLICABLE",
  NOT_APPLICABLE = "NOT_APPLICABLE",
}

export enum ControlRiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}
```

## Evidence

```ts
export enum EvidenceSensitivityLevel {
  INTERNAL = "INTERNAL",
  CONFIDENTIAL = "CONFIDENTIAL",
  RESTRICTED = "RESTRICTED",
}

export enum EvidenceVersionStatus {
  UPLOADED = "UPLOADED",
  QUARANTINED = "QUARANTINED",
  SECURITY_REJECTED = "SECURITY_REJECTED",
  PROCESSING = "PROCESSING",
  PROCESSING_FAILED = "PROCESSING_FAILED",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  SUPERSEDED = "SUPERSEDED",
  ARCHIVED = "ARCHIVED",
}

export enum SecurityScanStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  CLEAN = "CLEAN",
  MALICIOUS = "MALICIOUS",
  FAILED = "FAILED",
}

export enum EvidenceSource {
  MANUAL_UPLOAD = "MANUAL_UPLOAD",
  TASK_SUBMISSION = "TASK_SUBMISSION",
  INTEGRATION = "INTEGRATION",
}

export enum UploadIntentStatus {
  CREATED = "CREATED",
  UPLOADED = "UPLOADED",
  VALIDATING = "VALIDATING",
  FINALIZING = "FINALIZING",
  FINALIZED = "FINALIZED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}

export enum StorageReconciliationStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  REQUIRED = "REQUIRED",
  RETRYING = "RETRYING",
  RECONCILED = "RECONCILED",
  FAILED = "FAILED",
}
```

## Evidence Mapping

```ts
export enum EvidenceMappingStatus {
  SUGGESTED = "SUGGESTED",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum EvidenceMappingSource {
  AI_SUGGESTED = "AI_SUGGESTED",
  MANUAL = "MANUAL",
}
```

## Tasks

```ts
export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  SUBMITTED = "SUBMITTED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}
```

## AI

```ts
export enum AiAnalysisStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum AiDocumentType {
  POLICY = "POLICY",
  ACCESS_REVIEW = "ACCESS_REVIEW",
  TRAINING_REPORT = "TRAINING_REPORT",
  BACKUP_LOG = "BACKUP_LOG",
  INCIDENT_RECORD = "INCIDENT_RECORD",
  VENDOR_QUESTIONNAIRE = "VENDOR_QUESTIONNAIRE",
  OTHER = "OTHER",
}
```

## Reports

```ts
export enum ReportType {
  AUDIT_READINESS = "AUDIT_READINESS",
  MISSING_EVIDENCE = "MISSING_EVIDENCE",
  CONTROL_COVERAGE = "CONTROL_COVERAGE",
  EVIDENCE_INVENTORY = "EVIDENCE_INVENTORY",
}

export enum ReportStatus {
  PENDING = "PENDING",
  GENERATING = "GENERATING",
  READY = "READY",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}
```

## Auditor Access

```ts
export enum AuditorScopeType {
  FRAMEWORK = "FRAMEWORK",
  CONTROL = "CONTROL",
  EVIDENCE_ITEM = "EVIDENCE_ITEM",
  EVIDENCE_VERSION = "EVIDENCE_VERSION",
  REPORT = "REPORT",
}
```

## Deletion

```ts
export enum DeletionRequestStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
```

## Readiness

```ts
export enum ReadinessStatus {
  NOT_CALCULABLE = "NOT_CALCULABLE",
  CALCULATED = "CALCULATED",
}
```
