/** Provider-neutral contracts. Adapters must acknowledge delivery only after provider success. */
export interface NotificationEvent {
  id: string;
  organizationId: string;
  type: string;
  recipientId: string;
  title: string;
  body: string;
}
export interface NotificationChannel {
  send(event: NotificationEvent): Promise<{ providerId: string }>;
}
export interface Analytics {
  track(
    event: string,
    properties: Record<string, string | number | boolean>,
  ): void;
}
export interface ErrorTracker {
  capture(error: Error, context: Record<string, string>): void;
}
export interface StorageService {
  createUpload(input: {
    organizationId: string;
    entryId: string;
    mime: "image/jpeg" | "image/png" | "application/pdf";
    bytes: number;
  }): Promise<{ url: string; expiresAt: string }>;
  createDownload(path: string): Promise<{ url: string; expiresAt: string }>;
}
export interface BackgroundJobs {
  enqueue(
    type: "report" | "schedule" | "retention" | "account-deletion",
    organizationId: string,
    payload: Record<string, string>,
  ): Promise<string>;
}
// Email, FCM, signed attachment upload and job workers are not enabled in P0.
// The UI must not claim a message was sent or an upload succeeded without adapters.
