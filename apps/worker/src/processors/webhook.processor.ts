import { Worker, Job } from "bullmq";
import { redisConnection, automationEngine, writeLog } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { WebhookProcessJobData } from "@whatsapp-saas/types";

/**
 * Consome webhookQueue: processa o evento recebido do provedor
 * (mensagem recebida, entregue, lida, status de instância, erro).
 * A validação de assinatura e a idempotência já ocorreram na rota
 * POST /webhooks/messaging (seção 13) antes de o evento chegar aqui.
 */
export function registerWebhookProcessor() {
  const worker = new Worker<WebhookProcessJobData>(
    QUEUE_NAMES.WEBHOOK,
    async (job: Job<WebhookProcessJobData>) => {
      const event = await prisma.webhookEvent.findUnique({ where: { id: job.data.webhookEventId } });
      if (!event) return { skipped: true };

      try {
        const payload = event.payload as any;

        switch (event.eventType) {
          case "message_received": {
            // Correlaciona por telefone -> contato -> conversa mais recente -> sessão.
            const phone = payload?.from;
            if (phone) {
              const contact = await prisma.contact.findFirst({ where: { phone } });
              if (contact) {
                const conversation = await prisma.conversation.findFirst({
                  where: { contactId: contact.id },
                  orderBy: { updatedAt: "desc" },
                });
                if (conversation) {
                  await prisma.message.create({
                    data: {
                      conversationId: conversation.id,
                      instanceId: conversation.instanceId,
                      contactId: contact.id,
                      direction: "INBOUND",
                      status: "DELIVERED",
                      content: payload?.text ?? "",
                      providerMsgId: payload?.messageId,
                    },
                  });
                  const session = await prisma.session.findFirst({
                    where: { contactId: contact.id, status: "ACTIVE" },
                    orderBy: { createdAt: "desc" },
                  });
                  if (session) {
                    await automationEngine.resumeAfterReply(session.id);
                  }
                }
              }
            }
            break;
          }
          case "message_delivered":
          case "message_read": {
            if (payload?.messageId) {
              await prisma.message.updateMany({
                where: { providerMsgId: payload.messageId },
                data: { status: event.eventType === "message_read" ? "READ" : "DELIVERED" },
              });
            }
            break;
          }
          case "instance_disconnected": {
            if (payload?.instanceId) {
              await prisma.instance.update({ where: { id: payload.instanceId }, data: { status: "DISCONNECTED" } });
            }
            break;
          }
          case "instance_error": {
            if (payload?.instanceId) {
              await prisma.instance.update({
                where: { id: payload.instanceId },
                data: { status: "ERROR", lastError: payload?.error ?? "unknown" },
              });
            }
            break;
          }
          default:
            // Evento não mapeado - registrado mas ignorado deliberadamente.
            break;
        }

        await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: "PROCESSED", processedAt: new Date() } });
      } catch (err: any) {
        await prisma.webhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: err.message } });
        if (event.tenantId) {
          await writeLog({ tenantId: event.tenantId, action: "WEBHOOK_PROCESSING_FAILED", resource: "webhook_event", resourceId: event.id, metadata: { error: err.message } });
        }
        throw err; // permite retry via BullMQ
      }

      return { processed: true };
    },
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[webhook.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
