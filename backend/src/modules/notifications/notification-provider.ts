export type NotificationEmailMessage = {
  toUserId: string;
  subject: string;
  body: string;
  actionUrl?: string | null;
};

export type NotificationSendResult = {
  providerMessageId: string;
};

export interface NotificationEmailProvider {
  send(message: NotificationEmailMessage): Promise<NotificationSendResult>;
}
