import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from '../app/router';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: () => ({ matches: false, addListener: () => undefined, removeListener: () => undefined }),
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ data, meta: { requestId: 'test_req' } }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('frontend core workflows shell', () => {
  beforeEach(() => {
    window.localStorage.setItem('auditflow.activeCompanyId', 'company_test');
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return jsonResponse({
          user: { id: 'user_1', name: 'Test User', email: 'test@example.com', emailVerifiedAt: null },
          memberships: [{ id: 'mem_1', companyId: 'company_test', companyName: 'Test Co', role: 'OWNER', status: 'ACTIVE' }],
          session: { id: 'sess_1', idleExpiresAt: new Date().toISOString(), absoluteExpiresAt: new Date().toISOString() },
        });
      }
      if (url.includes('/api/dashboard/overview')) {
        return jsonResponse({
          readinessStatus: 'CALCULABLE',
          readinessPercent: 72.5,
          applicableEvidenceBasedControls: 4,
          readyControls: 2,
          inProgressControls: 1,
          notStartedControls: 1,
          missingRequiredEvidence: 3,
          overdueTasks: 1,
          needsReview: 2,
          evidenceVersionsNeedingReview: 1,
          mappingsNeedingReview: 1,
          expiringWithinDays: 30,
          expiringWithinDaysCount: 1,
          calculatedAt: new Date().toISOString(),
        });
      }
      if (url.includes('/api/dashboard/control-progress')) {
        return jsonResponse({ items: [] });
      }
      if (url.includes('/api/dashboard/missing-evidence')) {
        return jsonResponse({ items: [] });
      }
      if (url.includes('/api/dashboard/expiring-evidence')) {
        return jsonResponse({ items: [], expiringWithinDays: 30 });
      }
      if (url.includes('/api/dashboard/overdue-tasks')) {
        return jsonResponse({ items: [], calculatedAt: new Date().toISOString() });
      }
      return jsonResponse({ items: [] });
    }));
  });

  it('renders dashboard with live workflow sections', async () => {
    render(<AppRouter />);
    expect(screen.getByText('AuditFlow')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Readiness overview')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('72.5%')).toBeInTheDocument());
    expect(screen.getByText('Control progress')).toBeInTheDocument();
    expect(screen.getByText('Missing evidence')).toBeInTheDocument();
  });
});
