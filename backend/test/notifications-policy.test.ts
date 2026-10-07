import { describe, expect, it } from 'vitest';
import { NotificationListQuerySchema } from '../src/modules/notifications/notifications.schemas';
import { FakeEmailProvider } from '../src/modules/notifications/fake-email-provider';

describe('Pass 16 notification policy', () => {
  it('defaults to bounded list pagination', () => {
    expect(NotificationListQuerySchema.parse({})).toEqual({ page: 1, limit: 25, unreadOnly: false });
  });

  it('fake provider returns metadata only and never attaches evidence', async () => {
    const provider = new FakeEmailProvider();
    const result = await provider.send({ toUserId: 'user_1', subject: 'Evidence expires', body: 'Open AuditFlow to review.' });
    expect(result.providerMessageId).toMatch(/^fake_/);
    expect(JSON.stringify(result)).not.toContain('storage_key');
  });
});
