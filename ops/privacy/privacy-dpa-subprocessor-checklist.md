# Privacy, DPA, and Subprocessor Checklist

Status: BLOCKED until completed before customer launch.

## Customer-facing terms required

- retention period for evidence, reports, audit logs, AI analyses, temporary uploads
- deletion request workflow and waiting period
- legal hold behavior
- backup deletion limitation disclosure
- subprocessors list
- support access policy
- incident notification process

## Subprocessor inventory

| Vendor | Purpose | Data processed | Region/residency | Retention/training terms | Contract/DPA status |
|---|---|---|---|---|---|
| Object storage provider | private evidence object storage | evidence files and reports | | | BLOCKED |
| Database provider | PostgreSQL hosting/backups | metadata, audit logs, extracted text | | | BLOCKED |
| Email provider | notifications/invitations | minimal metadata and links | | | BLOCKED |
| AI provider | optional evidence analysis | bounded extracted evidence text | | | BLOCKED |

## Approval

- Privacy owner:
- Legal/DPA reviewer:
- Approved for customer evidence: yes/no
- Date:
