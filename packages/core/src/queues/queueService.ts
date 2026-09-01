import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type {
  SendMessageJobData,
  SessionAdvanceJobData,
  AutomationExecuteJobData,
  WebhookProcessJobData,
  NotificationJobData,
} from "@whatsapp-saas/types";

/**
 * QueueService: única porta de entrada para publicar jobs nas filas.
 * Separado de MessagingProvider e AutomationEngine (seção 31) - a API só
 * enfileira, quem processa de fato é o worker (apps/worker).
 */

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

export const messageQueue = new Queue<SendMessageJobData>(QUEUE_NAMES.MESSAGE, {
  connection: redisConnection,
  defaultJobOptions,
});

export const sessionQueue = new Queue<SessionAdvanceJobData>(QUEUE_NAMES.SESSION, {
  connection: redisConnection,
  defaultJobOptions,
});

export const automationQueue = new Queue<AutomationExecuteJobData>(QUEUE_NAMES.AUTOMATION, {
  connection: redisConnection,
  defaultJobOptions,
});

export const webhookQueue = new Queue<WebhookProcessJobData>(QUEUE_NAMES.WEBHOOK, {
  connection: redisConnection,
  defaultJobOptions,
});

export const notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATION, {
  connection: redisConnection,
  defaultJobOptions,
});

export const queueEvents = {
  message: new QueueEvents(QUEUE_NAMES.MESSAGE, { connection: redisConnection }),
  session: new QueueEvents(QUEUE_NAMES.SESSION, { connection: redisConnection }),
  automation: new QueueEvents(QUEUE_NAMES.AUTOMATION, { connection: redisConnection }),
  webhook: new QueueEvents(QUEUE_NAMES.WEBHOOK, { connection: redisConnection }),
  notification: new QueueEvents(QUEUE_NAMES.NOTIFICATION, { connection: redisConnection }),
};

/** Enfileira envio de mensagem com chave de idempotência (jobId = idempotencyKey). */
export async function enqueueSendMessage(data: SendMessageJobData) {
  return messageQueue.add("send-message", data, { jobId: data.idempotencyKey });
}

export async function enqueueSessionAdvance(data: SessionAdvanceJobData, delayMs = 0) {
  return sessionQueue.add("advance-session", data, { delay: delayMs });
}

export async function enqueueAutomationExecute(data: AutomationExecuteJobData, delayMs = 0) {
  return automationQueue.add("execute-automation", data, { delay: delayMs });
}

export async function enqueueWebhookProcess(data: WebhookProcessJobData) {
  return webhookQueue.add("process-webhook", data, { jobId: data.webhookEventId });
}

export async function enqueueNotification(data: NotificationJobData) {
  return notificationQueue.add("send-notification", data);
}
