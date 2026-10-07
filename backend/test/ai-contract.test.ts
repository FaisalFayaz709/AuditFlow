import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type RouteContract = {
  operationId: string;
  summary: string;
  authentication: { required: boolean; csrfRequiredForStateChange: boolean };
  authorization: { permission: string };
  audit: { event: string };
};

function loadContracts(): RouteContract[] {
  const raw = readFileSync(new URL('../src/openapi/route-contracts.v1.json', import.meta.url), 'utf8');
  return JSON.parse(raw).routes as RouteContract[];
}

describe('Pass 15 AI route contracts', () => {
  it('documents AI routes as protected, CSRF-guarded for mutations, and non-authoritative', () => {
    const routes = loadContracts();
    const run = routes.find((route) => route.operationId === 'runEvidenceAiAnalysis');
    const list = routes.find((route) => route.operationId === 'listEvidenceAiAnalyses');
    const patchSettings = routes.find((route) => route.operationId === 'updateCompanyAiSettings');

    expect(run).toBeDefined();
    expect(run?.authentication.required).toBe(true);
    expect(run?.authentication.csrfRequiredForStateChange).toBe(true);
    expect(run?.authorization.permission).toBe('ai.run');
    expect(run?.audit.event).toBe('AI_ANALYSIS_REQUESTED, AI_ANALYSIS_COMPLETED, AI_ANALYSIS_FAILED');
    expect(run?.summary).toContain('advisory');

    expect(list?.authentication.required).toBe(true);
    expect(list?.authorization.permission).toBe('ai.read');
    expect(patchSettings?.authentication.csrfRequiredForStateChange).toBe(true);
    expect(patchSettings?.audit.event).toBe('AI_SETTINGS_UPDATED');
  });
});
