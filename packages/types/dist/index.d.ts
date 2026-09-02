export type JwtUserPayload = {
    sub: string;
    tenantId: string;
    role: "ADMIN" | "CLIENT";
};
export type ApiError = {
    statusCode: number;
    message: string;
    code?: string;
    details?: unknown;
};
export type PaginatedResult<T> = {
    data: T[];
    page: number;
    pageSize: number;
    total: number;
};
export declare const QUEUE_NAMES: {
    readonly MESSAGE: "messageQueue";
    readonly SESSION: "sessionQueue";
    readonly AUTOMATION: "automationQueue";
    readonly WEBHOOK: "webhookQueue";
    readonly NOTIFICATION: "notificationQueue";
};
export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export type SendMessageJobData = {
    tenantId: string;
    instanceId: string;
    senderId?: string;
    conversationId: string;
    contactId: string;
    content: string;
    idempotencyKey: string;
};
export type SessionAdvanceJobData = {
    sessionId: string;
};
export type AutomationExecuteJobData = {
    executionId: string;
};
export type WebhookProcessJobData = {
    webhookEventId: string;
};
export type NotificationJobData = {
    tenantId: string;
    type: string;
    title: string;
    message: string;
};
