import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { AppError } from '../../shared/errors.js';

export const allowedUploadMimeTypes = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'text/plain',
] as const;

export type AllowedUploadMimeType = (typeof allowedUploadMimeTypes)[number];

const extensionByMime: Record<AllowedUploadMimeType, readonly string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
};

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sanitizeDisplayFilename(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop()?.trim() || 'evidence-file';
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'evidence-file';
}

function hasMagicBytes(mimeType: string, buffer: Buffer): boolean {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // CSV/TXT are text formats; content-signature checks are advisory in Pass 06.
  if (mimeType === 'text/csv' || mimeType === 'text/plain') return !buffer.includes(0x00);
  return false;
}

export function assertAllowedUpload(params: { fileName: string; mimeType: string; buffer: Buffer; maxBytes: number }): void {
  if (params.buffer.length <= 0) {
    throw new AppError({ statusCode: 422, code: 'EMPTY_UPLOAD', message: 'Uploaded evidence file is empty.' });
  }

  if (params.buffer.length > params.maxBytes) {
    throw new AppError({ statusCode: 413, code: 'UPLOAD_TOO_LARGE', message: 'Evidence upload exceeds the configured file size limit.' });
  }

  if (!allowedUploadMimeTypes.includes(params.mimeType as AllowedUploadMimeType)) {
    throw new AppError({ statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Evidence file type is not allowed for the MVP.' });
  }

  const extension = extname(params.fileName).toLowerCase();
  const expectedExtensions = extensionByMime[params.mimeType as AllowedUploadMimeType];
  if (!expectedExtensions.includes(extension)) {
    throw new AppError({
      statusCode: 415,
      code: 'UPLOAD_EXTENSION_MIME_MISMATCH',
      message: 'Evidence file extension does not match the declared MIME type.',
      details: [{ field: 'fileName', reason: `${extension} not valid for ${params.mimeType}` }],
    });
  }

  if (!hasMagicBytes(params.mimeType, params.buffer)) {
    throw new AppError({
      statusCode: 415,
      code: 'UPLOAD_CONTENT_SIGNATURE_MISMATCH',
      message: 'Evidence file content signature does not match the declared MIME type.',
    });
  }
}

export function makeEvidenceObjectKey(params: { companyId: string; evidenceItemId?: string; fileName: string; temporary?: boolean }): string {
  // v2.1 lock: object keys must be generated and must not depend on user-provided filenames or paths.
  // The display filename is preserved separately in database metadata after sanitization.
  void params.fileName;
  const prefix = params.temporary ? 'tmp' : 'evidence';
  const itemPart = params.evidenceItemId ?? 'new';
  return `companies/${params.companyId}/${prefix}/${itemPart}/${randomUUID()}`;
}

export function isSecurityBlockedEvidenceStatus(status: string): boolean {
  return status === 'QUARANTINED' || status === 'SECURITY_REJECTED';
}

export function assertEvidenceDownloadSecurityClearance(params: { status: string }): void {
  if (isSecurityBlockedEvidenceStatus(params.status)) {
    throw new AppError({
      statusCode: 403,
      code: 'EVIDENCE_DOWNLOAD_BLOCKED',
      message: 'This evidence version is blocked from download pending security clearance.',
    });
  }
}

export function deriveTitleFromUpload(params: { title?: string; fileName: string }): string {
  return params.title?.trim() || sanitizeDisplayFilename(params.fileName).replace(/\.[^.]+$/, '') || 'Untitled evidence';
}
