import { Worker, Job } from "bullmq";
import { redisConnection, getMessagingProvider, writeLog } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { SendMessageJobData } from "@whatsapp-saas/types";

/**
 * Consome messageQueue: efetivamente entrega a mensagem através do
 * MessagingProvider ativo (Mock ou WhatsApp Cloud API oficial).
 *
 * Idempotência: jobId = idempotencyKey (definido em enqueueSendMessage),
 * então o BullMQ já rejeita reenfileiramentos duplicados do mesmo job.
 * Retry/backoff/DLQ são configurados via defaultJobOptions em QueueService.
 */
export function registerMessageProcessor() {
  const worker = new Worker<SendMessageJobData>(
    QUEUE_NAMES.MESSAGE,
    async (job: Job<SendMessageJobData>) => {
      const { tenantId, instanceId, contactId, conversationId, content, idempotencyKey } = job.data;

      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (!contact || contact.status !== "ACTIVE") {
        // Nunca envia para quem não tem consentimento ativo, mesmo que o job já exista na fila.
        await writeLog({ tenantId, action: "MESSAGE_BLOCKED_NO_CONSENT", resource: "contact", resourceId: contactId });
        return { skipped: true, reason: "no_active_consent" };
      }

      const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
      const provider = getMessagingProvider(instance?.provider);
      const result = await provider.sendTextMessage({ instanceId, to: contact.phone, text: content, idempotencyKey });

      await prisma.message.updateMany({
        where: { conversationId, contactId, content, status: "QUEUED" },
        data: {
          status: result.status === "SENT" ? "SENT" : "FAILED",
          providerMsgId: result.providerMessageId || undefined,
          metadata: result.error ? { error: result.error } : undefined,
        },
      });

      await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } });

      if (result.status === "FAILED") {
        throw new Error(result.error ?? "Falha ao enviar mensagem"); // permite retry/backoff do BullMQ
      }

      return { providerMessageId: result.providerMessageId };
    },
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[message.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
