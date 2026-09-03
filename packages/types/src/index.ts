// Tipos compartilhados entre api / worker / web.

export type JwtUserPayload = {
  sub: string; // userId
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

// Nomes das filas BullMQ - usados por api e worker para não divergirem.
export const QUEUE_NAMES = {
  MESSAGE: "messageQueue",
  SESSION: "sessionQueue",
  AUTOMATION: "automationQueue",
  WEBHOOK: "webhookQueue",
  NOTIFICATION: "notificationQueue",
  INSTANCE_CONNECT: "instanceConnectQueue",
  AI_REPLY: "aiReplyQueue",
  GROUP_JOIN: "groupJoinQueue",
} as const;

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

export type InstanceConnectJobData = {
  instanceId: string;
  // Quando presente, conecta pedindo um código de pareamento (letras+números)
  // pra esse número de telefone em vez de gerar QR Code - ver BaileysProvider.
  phoneNumber?: string;
};

export type AiReplyJobData = {
  conversationId: string;
};

export type GroupJoinJobData = {
  groupJoinId: string;
};
