-- Pass 24: Framework upgrade reconciliation.
-- v2.1 requires upgrades to create a DRAFT_RECONCILIATION enrollment, preview matches,
-- require human review, activate atomically, and copy compatible mappings only as PENDING_REVIEW.

CREATE TABLE IF NOT EXISTS framework_upgrade_reconciliations (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  old_company_framework_id TEXT NOT NULL,
  new_company_framework_id TEXT NOT NULL UNIQUE,
  target_framework_version_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  preview_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL,
  reviewed_by_user_id TEXT,
  reviewed_at TIMESTAMP(3),
  activated_by_user_id TEXT,
  activated_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT framework_upgrade_reconciliations_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_old_enrollment_fk FOREIGN KEY (old_company_framework_id) REFERENCES company_frameworks(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_new_enrollment_fk FOREIGN KEY (new_company_framework_id) REFERENCES company_frameworks(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_target_version_fk FOREIGN KEY (target_framework_version_id) REFERENCES framework_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_created_by_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_reviewed_by_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_activated_by_fk FOREIGN KEY (activated_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_reconciliations_status_check CHECK (status IN ('OPEN', 'REVIEWED', 'ACTIVATED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS framework_upgrade_control_matches (
  id TEXT PRIMARY KEY,
  reconciliation_id TEXT NOT NULL,
  match_type TEXT NOT NULL,
  stable_code TEXT NOT NULL,
  old_control_id TEXT,
  new_control_id TEXT,
  materially_changed BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT framework_upgrade_control_matches_reconciliation_fk FOREIGN KEY (reconciliation_id) REFERENCES framework_upgrade_reconciliations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_control_matches_old_control_fk FOREIGN KEY (old_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_control_matches_new_control_fk FOREIGN KEY (new_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_control_matches_type_check CHECK (match_type IN ('MATCHED', 'ADDED', 'REMOVED', 'MATERIALLY_CHANGED'))
);

CREATE TABLE IF NOT EXISTS framework_upgrade_requirement_matches (
  id TEXT PRIMARY KEY,
  reconciliation_id TEXT NOT NULL,
  control_match_id TEXT,
  match_type TEXT NOT NULL,
  stable_control_code TEXT NOT NULL,
  stable_requirement_code TEXT NOT NULL,
  old_requirement_id TEXT,
  new_requirement_id TEXT,
  old_control_id TEXT,
  new_control_id TEXT,
  materially_changed BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT framework_upgrade_requirement_matches_reconciliation_fk FOREIGN KEY (reconciliation_id) REFERENCES framework_upgrade_reconciliations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_control_match_fk FOREIGN KEY (control_match_id) REFERENCES framework_upgrade_control_matches(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_old_req_fk FOREIGN KEY (old_requirement_id) REFERENCES evidence_requirements(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_new_req_fk FOREIGN KEY (new_requirement_id) REFERENCES evidence_requirements(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_old_control_fk FOREIGN KEY (old_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_new_control_fk FOREIGN KEY (new_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_requirement_matches_type_check CHECK (match_type IN ('MATCHED', 'ADDED', 'REMOVED', 'MATERIALLY_CHANGED'))
);

CREATE TABLE IF NOT EXISTS framework_upgrade_mapping_candidates (
  id TEXT PRIMARY KEY,
  reconciliation_id TEXT NOT NULL,
  old_mapping_id TEXT NOT NULL,
  evidence_version_id TEXT NOT NULL,
  old_control_id TEXT NOT NULL,
  old_requirement_id TEXT,
  new_control_id TEXT NOT NULL,
  new_requirement_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW_READY',
  copied_mapping_id TEXT,
  reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT framework_upgrade_mapping_candidates_reconciliation_fk FOREIGN KEY (reconciliation_id) REFERENCES framework_upgrade_reconciliations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_old_mapping_fk FOREIGN KEY (old_mapping_id) REFERENCES evidence_control_mappings(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_ev_fk FOREIGN KEY (evidence_version_id) REFERENCES evidence_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_old_control_fk FOREIGN KEY (old_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_old_req_fk FOREIGN KEY (old_requirement_id) REFERENCES evidence_requirements(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_new_control_fk FOREIGN KEY (new_control_id) REFERENCES controls(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_new_req_fk FOREIGN KEY (new_requirement_id) REFERENCES evidence_requirements(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_copied_mapping_fk FOREIGN KEY (copied_mapping_id) REFERENCES evidence_control_mappings(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT framework_upgrade_mapping_candidates_status_check CHECK (status IN ('PENDING_REVIEW_READY', 'COPIED_PENDING_REVIEW', 'SKIPPED'))
);

CREATE INDEX IF NOT EXISTS idx_framework_upgrade_reconciliations_old ON framework_upgrade_reconciliations(company_id, old_company_framework_id, status);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_reconciliations_new ON framework_upgrade_reconciliations(company_id, new_company_framework_id, status);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_reconciliations_target_version ON framework_upgrade_reconciliations(target_framework_version_id);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_control_matches_status ON framework_upgrade_control_matches(reconciliation_id, match_type);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_control_matches_old_control ON framework_upgrade_control_matches(old_control_id);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_control_matches_new_control ON framework_upgrade_control_matches(new_control_id);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_requirement_matches_status ON framework_upgrade_requirement_matches(reconciliation_id, match_type);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_requirement_matches_old_req ON framework_upgrade_requirement_matches(old_requirement_id);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_requirement_matches_new_req ON framework_upgrade_requirement_matches(new_requirement_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_framework_upgrade_mapping_candidates_old_mapping ON framework_upgrade_mapping_candidates(reconciliation_id, old_mapping_id);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_mapping_candidates_status ON framework_upgrade_mapping_candidates(reconciliation_id, status);
CREATE INDEX IF NOT EXISTS idx_framework_upgrade_mapping_candidates_ev ON framework_upgrade_mapping_candidates(evidence_version_id);
