import { Queue, QueueEvents } from "bullmq";
import type { SendMessageJobData, SessionAdvanceJobData, AutomationExecuteJobData, WebhookProcessJobData, NotificationJobData } from "@whatsapp-saas/types";
export declare const messageQueue: Queue<SendMessageJobData, any, string, SendMessageJobData, any, string>;
export declare const sessionQueue: Queue<SessionAdvanceJobData, any, string, SessionAdvanceJobData, any, string>;
export declare const automationQueue: Queue<AutomationExecuteJobData, any, string, AutomationExecuteJobData, any, string>;
export declare const webhookQueue: Queue<WebhookProcessJobData, any, string, WebhookProcessJobData, any, string>;
export declare const notificationQueue: Queue<NotificationJobData, any, string, NotificationJobData, any, string>;
export declare const queueEvents: {
    message: QueueEvents;
    session: QueueEvents;
    automation: QueueEvents;
    webhook: QueueEvents;
    notification: QueueEvents;
};
/** Enfileira envio de mensagem com chave de idempotência (jobId = idempotencyKey). */
export declare function enqueueSendMessage(data: SendMessageJobData): Promise<import("bullmq").Job<SendMessageJobData, any, string>>;
export declare function enqueueSessionAdvance(data: SessionAdvanceJobData, delayMs?: number): Promise<import("bullmq").Job<SessionAdvanceJobData, any, string>>;
export declare function enqueueAutomationExecute(data: AutomationExecuteJobData, delayMs?: number): Promise<import("bullmq").Job<AutomationExecuteJobData, any, string>>;
export declare function enqueueWebhookProcess(data: WebhookProcessJobData): Promise<import("bullmq").Job<WebhookProcessJobData, any, string>>;
export declare function enqueueNotification(data: NotificationJobData): Promise<import("bullmq").Job<NotificationJobData, any, string>>;
