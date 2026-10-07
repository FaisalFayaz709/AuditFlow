import { describe, expect, it } from 'vitest';
import { AppError } from '../src/shared/errors.js';
import { validateFrameworkVersionForPublication } from '../src/modules/frameworks/frameworks.service.js';

describe('Pass 05 framework publication/enrollment validation', () => {
  it('rejects evidence-based controls without required evidence requirements', () => {
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [{ id: 'control_1', code: 'AC-001', control_type: 'EVIDENCE_BASED', sort_order: 1, evidence_requirements: [] }],
      }),
    ).toThrow(AppError);
  });

  it('allows informational controls with no required requirements', () => {
    expect(() =>
      validateFrameworkVersionForPublication({
        controls: [{ id: 'control_info', code: 'INFO-001', control_type: 'INFORMATIONAL', sort_order: 1, evidence_requirements: [] }],
      }),
    ).not.toThrow();
  });
});
