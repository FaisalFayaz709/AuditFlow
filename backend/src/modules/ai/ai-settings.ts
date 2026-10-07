import type { AppEnv } from '../../config/env.js';

export type CompanySettingsJson = Record<string, unknown> | null | undefined;

type RawAiSettings = {
  enabled?: unknown;
  allowRestrictedEvidence?: unknown;
};

export function readAiSettings(settingsJson: CompanySettingsJson, env: AppEnv) {
  const root = settingsJson && typeof settingsJson === 'object' ? settingsJson : {};
  const raw = 'ai' in root && typeof root.ai === 'object' && root.ai !== null ? (root.ai as RawAiSettings) : {};

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : env.AI_DEFAULT_ENABLED,
    allowRestrictedEvidence: typeof raw.allowRestrictedEvidence === 'boolean' ? raw.allowRestrictedEvidence : false,
  };
}

export function writeAiSettings(settingsJson: CompanySettingsJson, next: { enabled: boolean; allowRestrictedEvidence: boolean }) {
  const root = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson) ? { ...settingsJson } : {};
  return {
    ...root,
    ai: {
      enabled: next.enabled,
      allowRestrictedEvidence: next.allowRestrictedEvidence,
    },
  };
}
