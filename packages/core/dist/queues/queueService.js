"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueEvents = exports.notificationQueue = exports.webhookQueue = exports.automationQueue = exports.sessionQueue = exports.messageQueue = void 0;
exports.enqueueSendMessage = enqueueSendMessage;
exports.enqueueSessionAdvance = enqueueSessionAdvance;
exports.enqueueAutomationExecute = enqueueAutomationExecute;
exports.enqueueWebhookProcess = enqueueWebhookProcess;
exports.enqueueNotification = enqueueNotification;
const bullmq_1 = require("bullmq");
const redis_1 = require("../redis");
const types_1 = require("@whatsapp-saas/types");
/**
 * QueueService: única porta de entrada para publicar jobs nas filas.
 * Separado de MessagingProvider e AutomationEngine (seção 31) - a API só
 * enfileira, quem processa de fato é o worker (apps/worker).
 */
const defaultJobOptions = {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 24 * 3600 },
};
exports.messageQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.MESSAGE, {
    connection: redis_1.redisConnection,
    defaultJobOptions,
});
exports.sessionQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.SESSION, {
    connection: redis_1.redisConnection,
    defaultJobOptions,
});
exports.automationQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.AUTOMATION, {
    connection: redis_1.redisConnection,
    defaultJobOptions,
});
exports.webhookQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.WEBHOOK, {
    connection: redis_1.redisConnection,
    defaultJobOptions,
});
exports.notificationQueue = new bullmq_1.Queue(types_1.QUEUE_NAMES.NOTIFICATION, {
    connection: redis_1.redisConnection,
    defaultJobOptions,
});
exports.queueEvents = {
    message: new bullmq_1.QueueEvents(types_1.QUEUE_NAMES.MESSAGE, { connection: redis_1.redisConnection }),
    session: new bullmq_1.QueueEvents(types_1.QUEUE_NAMES.SESSION, { connection: redis_1.redisConnection }),
    automation: new bullmq_1.QueueEvents(types_1.QUEUE_NAMES.AUTOMATION, { connection: redis_1.redisConnection }),
    webhook: new bullmq_1.QueueEvents(types_1.QUEUE_NAMES.WEBHOOK, { connection: redis_1.redisConnection }),
    notification: new bullmq_1.QueueEvents(types_1.QUEUE_NAMES.NOTIFICATION, { connection: redis_1.redisConnection }),
};
/** Enfileira envio de mensagem com chave de idempotência (jobId = idempotencyKey). */
async function enqueueSendMessage(data) {
    return exports.messageQueue.add("send-message", data, { jobId: data.idempotencyKey });
}
async function enqueueSessionAdvance(data, delayMs = 0) {
    return exports.sessionQueue.add("advance-session", data, { delay: delayMs });
}
async function enqueueAutomationExecute(data, delayMs = 0) {
    return exports.automationQueue.add("execute-automation", data, { delay: delayMs });
}
async function enqueueWebhookProcess(data) {
    return exports.webhookQueue.add("process-webhook", data, { jobId: data.webhookEventId });
}
async function enqueueNotification(data) {
    return exports.notificationQueue.add("send-notification", data);
}
