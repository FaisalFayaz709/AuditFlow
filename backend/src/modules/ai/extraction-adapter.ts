import type { PrivateObjectStorage } from '../../shared/storage.js';

export type ExtractionResult = {
  text: string;
  source: 'existing_extracted_text' | 'object_text' | 'metadata_only';
  truncated: boolean;
};

type EvidenceVersionForExtraction = {
  extracted_text?: string | null;
  storage_key: string;
  file_name: string;
  mime_type: string;
};

async function streamToBuffer(stream: NodeJS.ReadableStream, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.length;
    if (total > maxBytes) {
      chunks.push(buffer.subarray(0, Math.max(0, buffer.length - (total - maxBytes))));
      break;
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export class BasicExtractionAdapter {
  constructor(private readonly storage: PrivateObjectStorage, private readonly maxChars: number) {}

  async extract(version: EvidenceVersionForExtraction): Promise<ExtractionResult> {
    if (version.extracted_text?.trim()) {
      return this.bound(version.extracted_text, 'existing_extracted_text');
    }

    if (['text/plain', 'text/csv', 'application/csv'].includes(version.mime_type)) {
      const buffer = await streamToBuffer(this.storage.createReadStream(version.storage_key), this.maxChars * 4);
      return this.bound(buffer.toString('utf8'), 'object_text');
    }

    return this.bound(`No text extractor is enabled yet for ${version.mime_type}. File name: ${version.file_name}.`, 'metadata_only');
  }

  private bound(text: string, source: ExtractionResult['source']): ExtractionResult {
    const normalized = text.replace(/\u0000/g, '').trim();
    const bounded = normalized.slice(0, this.maxChars);
    return { text: bounded, source, truncated: normalized.length > bounded.length };
  }
}
