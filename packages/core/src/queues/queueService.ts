import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "../redis";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type {
  SendMessageJobData,
  SessionAdvanceJobData,
  AutomationExecuteJobData,
  WebhookProcessJobData,
  NotificationJobData,
  InstanceConnectJobData,
  AiReplyJobData,
  GroupJoinJobData,
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

// Conexão de instâncias via QR Code (WHATSAPP_QR): abrir/retomar sessão Baileys
// é assíncrono (gera QR, espera scan, só então conecta), então a API só
// enfileira e o worker processa - mesma separação das demais filas.
export const instanceConnectQueue = new Queue<InstanceConnectJobData>(QUEUE_NAMES.INSTANCE_CONNECT, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
});

// Resposta automática por IA (seção 34): enfileirada com um delay (ver
// enqueueAiReply) para simular tempo de digitação humano - nunca processada
// instantaneamente.
export const aiReplyQueue = new Queue<AiReplyJobData>(QUEUE_NAMES.AI_REPLY, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

// Entrar em grupo com todos os números (seção 15/38): cada instância elegível
// (WHATSAPP_QR conectada) gera um job aqui, já enfileirado com um delay
// escalonado (ver groups.service.ts joinAll) - attempts:1 porque um retry
// automático faria a MESMA instância tentar entrar de novo sem o
// espaçamento pensado para o lote inteiro; falhas ficam visíveis para o
// usuário na tela em vez de serem retentadas silenciosamente.
export const groupJoinQueue = new Queue<GroupJoinJobData>(QUEUE_NAMES.GROUP_JOIN, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 1 },
});

export const queueEvents = {
  message: new QueueEvents(QUEUE_NAMES.MESSAGE, { connection: redisConnection }),
  session: new QueueEvents(QUEUE_NAMES.SESSION, { connection: redisConnection }),
  automation: new QueueEvents(QUEUE_NAMES.AUTOMATION, { connection: redisConnection }),
  webhook: new QueueEvents(QUEUE_NAMES.WEBHOOK, { connection: redisConnection }),
  notification: new QueueEvents(QUEUE_NAMES.NOTIFICATION, { connection: redisConnection }),
  instanceConnect: new QueueEvents(QUEUE_NAMES.INSTANCE_CONNECT, { connection: redisConnection }),
  aiReply: new QueueEvents(QUEUE_NAMES.AI_REPLY, { connection: redisConnection }),
  groupJoin: new QueueEvents(QUEUE_NAMES.GROUP_JOIN, { connection: redisConnection }),
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

/** Enfileira (re)conexão de uma instância WHATSAPP_QR - idempotente por instância. */
export async function enqueueInstanceConnect(data: InstanceConnectJobData) {
  return instanceConnectQueue.add("connect-instance", data, { jobId: data.instanceId });
}

/** Enfileira uma resposta automática por IA, com delay (ms) para simular tempo de digitação. */
export async function enqueueAiReply(data: AiReplyJobData, delayMs = 0) {
  return aiReplyQueue.add("ai-reply", data, { delay: delayMs });
}

/**
 * Enfileira a tentativa de UMA instância entrar num grupo via link de
 * convite. delayMs escalona a entrada de cada instância dentro de um lote
 * (várias instâncias entrando no mesmo grupo ao mesmo tempo é um padrão que
 * o WhatsApp associa a bots) - jobId = groupJoinId evita duplicar a mesma
 * tentativa.
 */
export async function enqueueGroupJoin(data: GroupJoinJobData, delayMs = 0) {
  return groupJoinQueue.add("group-join", data, { delay: delayMs, jobId: data.groupJoinId });
}
