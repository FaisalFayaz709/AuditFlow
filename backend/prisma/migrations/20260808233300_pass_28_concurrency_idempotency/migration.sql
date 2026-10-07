-- Pass 28: additional database-side guard for concurrent deletion requests.
-- This preserves the v2.1 archive-first, policy-controlled purge workflow by
-- preventing two active deletion requests for the same company/entity pair.
CREATE UNIQUE INDEX IF NOT EXISTS deletion_requests_one_active_entity_idx
  ON deletion_requests (company_id, entity_type, entity_id)
  WHERE status IN ('REQUESTED', 'APPROVED', 'SCHEDULED', 'RUNNING');
