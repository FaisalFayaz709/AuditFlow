import type { AppEnv } from '../../config/env.js';
import type { NotificationEmailProvider } from './notification-provider.js';
import { FakeEmailProvider } from './fake-email-provider.js';

export function createNotificationEmailProvider(env: AppEnv): NotificationEmailProvider {
  switch (env.NOTIFICATION_EMAIL_PROVIDER) {
    case 'fake':
      return new FakeEmailProvider();
  }
}
