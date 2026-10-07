#!/usr/bin/env tsx
/**
 * AuditFlow specification guard.
 *
 * Scans active source files for forbidden architecture/auth/compliance patterns
 * and verifies that canonical specification-compliance docs are present.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const implementationRoots = ['backend/src', 'frontend/src', 'backend/prisma', 'adr'];
const excludedDirs = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const docsRequired = [
  'docs/spec-compliance/v2.1-traceability-matrix.md',
  'docs/spec-compliance/locked-stack-rules.md',
  'docs/spec-compliance/forbidden-deviations.md',
  'docs/spec-compliance/implementation-order.md',
];
const violations: string[] = [];

function walk(dir: string): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    if (excludedDirs.has(entry)) continue;
    const path = join(absolute, entry);
    const rel = path.slice(root.length + 1);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(rel));
    else if (/\.(ts|tsx|js|jsx|prisma|md|json)$/.test(entry)) out.push(path);
  }
  return out;
}

const files = implementationRoots.flatMap(walk);
function addViolation(file: string, code: string, message: string) {
  violations.push(`${code} ${file}: ${message}`);
}

for (const file of files) {
  const rel = file.slice(root.length + 1);
  const text = readFileSync(file, 'utf8');
  const lower = text.toLowerCase();

  if (rel.includes('backend/src') || rel.includes('frontend/src')) {
    if (/\b(localStorage|sessionStorage)\s*\./.test(text) && lower.includes('token')) {
      addViolation(rel, 'AF-AUTH-001', 'Do not store auth tokens in browser storage. Use opaque server-side sessions in HttpOnly cookies.');
    }
    if (/\b(jwt\b|jsonwebtoken|bearer token)/i.test(text) && !rel.includes('test') && !rel.includes('openapi')) {
      addViolation(rel, 'AF-AUTH-002', 'Browser MVP must not introduce JWT access-token authentication.');
    }
    if (/certif(y|ied|ication)|guaranteed compliance|automatic compliance|auditor replacement/i.test(text)) {
      addViolation(rel, 'AF-COPY-001', 'Product copy must use readiness/evidence language, not certification or automatic-compliance claims.');
    }
  }

  if (/microservice|kubernetes|k8s|distributed transaction|kafka/i.test(text) && !rel.startsWith('adr/') && !rel.endsWith('SPEC_LOCK.md')) {
    addViolation(rel, 'AF-ARCH-001', 'Initial implementation must not introduce a microservices/Kubernetes/event-streaming-first architecture.');
  }

  if (rel.endsWith('schema.prisma') || rel.includes('backend/src')) {
    if (text.includes('current_version_id')) {
      addViolation(rel, 'AF-EVIDENCE-001', 'Use latest_version_id and current_approved_version_id; do not add current_version_id.');
    }
  }
}

for (const doc of docsRequired) {
  if (!existsSync(join(root, doc))) addViolation(doc, 'AF-DOCS-001', 'Required specification-compliance document is missing.');
}

if (violations.length) {
  console.error('\nAuditFlow specification guard failed.\n');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`AuditFlow specification guard passed. Scanned ${files.length} active source files.`);
