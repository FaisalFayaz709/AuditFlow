import { describe, expect, it } from 'vitest';
import type { NotificationPreferencesResponse } from '../features/notifications/notifications-api';

describe('Pass 35 notification preferences UI contract', () => {
  it('keeps mandatory security/invitation notifications separate from reducible categories', () => {
    const response: NotificationPreferencesResponse = {
      contractVersion: 'notification-delivery-v1.0-pass-35',
      mandatoryTypes: ['ACCOUNT_SECURITY_EVENT', 'INVITATION_SENT'],
      preferences: [],
      catalog: [
        { type: 'ACCOUNT_SECURITY_EVENT', category: 'ACCOUNT_SECURITY', mandatory: true },
        { type: 'TASK_OVERDUE', category: 'WORKFLOW', mandatory: false },
      ],
    };
    expect(response.mandatoryTypes).toContain('ACCOUNT_SECURITY_EVENT');
    expect(response.catalog.find((item) => item.type === 'TASK_OVERDUE')?.mandatory).toBe(false);
  });
});
