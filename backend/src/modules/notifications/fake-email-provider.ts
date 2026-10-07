import type { NotificationEmailMessage, NotificationEmailProvider } from './notification-provider.js';

export class FakeEmailProvider implements NotificationEmailProvider {
  async send(message: NotificationEmailMessage) {
    if (JSON.stringify(message).toLowerCase().includes('storage_key')) {
      throw new Error('Fake provider refused sensitive notification payload.');
    }
    const safeId = `fake_${Buffer.from(`${message.toUserId}:${message.subject}`).toString('base64url').slice(0, 24)}`;
    return { providerMessageId: safeId };
  }
}
