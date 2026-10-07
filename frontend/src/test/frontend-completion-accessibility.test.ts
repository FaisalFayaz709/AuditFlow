import { describe, expect, it } from 'vitest';
import { PASS_37_FRONTEND_ROUTE_MANIFEST, PASS_37_REQUIRED_FRONTEND_STATES } from '../app/frontend-route-manifest';
import { PASS_37_ACCESSIBILITY_CONTRACT, validatePass37FrontendManifest } from '../features/accessibility/accessibility-contract';

describe('Pass 37 frontend completion and accessibility manifest', () => {
  it('covers every required workflow route', () => {
    expect(validatePass37FrontendManifest()).toEqual([]);
    expect(PASS_37_FRONTEND_ROUTE_MANIFEST.length).toBeGreaterThanOrEqual(14);
  });

  it('requires all UI state categories for every workflow', () => {
    for (const route of PASS_37_FRONTEND_ROUTE_MANIFEST) {
      expect(route.requiredStates).toEqual(PASS_37_REQUIRED_FRONTEND_STATES);
    }
  });

  it('requires non-color status cues and backend authority', () => {
    expect(PASS_37_ACCESSIBILITY_CONTRACT.statusCuePolicy.nonColorRequired).toBe(true);
    expect(PASS_37_ACCESSIBILITY_CONTRACT.sensitiveUiPolicy.backendAuthorizationIsAuthoritative).toBe(true);
    expect(PASS_37_ACCESSIBILITY_CONTRACT.sensitiveUiPolicy.noSecretStorageKeys).toBe(true);
  });
});
