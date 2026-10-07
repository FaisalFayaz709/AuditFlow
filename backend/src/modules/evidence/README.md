# Evidence Module — Pass 06

Owns secure staged upload, EvidenceItem/EvidenceVersion metadata, local private-object storage abstraction, tenant-scoped evidence reads, version listing, and authorized streaming downloads.

Locked boundaries for this pass:

- No evidence approval/rejection yet; that is Pass 07.
- No evidence-to-control mappings yet; that is Pass 08.
- No readiness calculation yet; that is Pass 09.
- No external AI processing yet; AI remains later and advisory only.
- No public object URLs or direct storage keys in API responses.

Security-rejected or quarantined binaries are blocked from normal download routes.
