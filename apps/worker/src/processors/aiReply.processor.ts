import { randomUUID } from "crypto";
import { Worker, Job } from "bullmq";
import { redisConnection, generateAiReply, enqueueSendMessage, writeLog, emitToTenant } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { AiReplyJobData } from "@whatsapp-saas/types";

// Quantas mensagens recentes da conversa são usadas como contexto para a IA.
const HISTORY_LIMIT = 12;

/**
 * Consome aiReplyQueue (seção 34): gera e envia a resposta automática por IA
 * para uma conversa. Enfileirado com delay (ver enqueueAiReply em
 * handleInboundMessage.ts) para simular tempo de digitação humano.
 *
 * As condições (aiAutoReplyEnabled, automationPaused, contato ACTIVE) já
 * foram checadas no momento do enfileiramento, mas são REVALIDADAS aqui,
 * porque podem ter mudado no intervalo do delay (ex: um atendente humano
 * assumiu a conversa, ou o contato revogou consentimento).
 */
export function registerAiReplyProcessor() {
  const worker = new Worker<AiReplyJobData>(
    QUEUE_NAMES.AI_REPLY,
    async (job: Job<AiReplyJobData>) => {
      const { conversationId } = job.data;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { contact: true, instance: { include: { persona: true } } },
      });
      if (!conversation) return { skipped: true, reason: "conversation_not_found" };

      if (
        !conversation.instance.aiAutoReplyEnabled ||
        conversation.automationPaused ||
        conversation.contact.status !== "ACTIVE"
      ) {
        return { skipped: true, reason: "conditions_no_longer_met" };
      }

      const recentMessages = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      });

      const history = recentMessages
        .slice()
        .reverse()
        .filter((m) => !!m.content)
        .map((m) => ({
          role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
          content: m.content as string,
        }));

      // Perfil de Conversa (seção 38): o texto livre da instância continua
      // tendo prioridade quando preenchido - o Perfil só entra como
      // alternativa reutilizável quando não há texto livre configurado.
      const systemPrompt = conversation.instance.aiSystemPrompt ?? conversation.instance.persona?.systemPrompt ?? null;

      const result = await generateAiReply({
        history,
        systemPrompt,
      });

      if (!result.ok) {
        await writeLog({
          tenantId: conversation.tenantId,
          action: "AI_REPLY_FAILED",
          resource: "conversation",
          resourceId: conversationId,
          metadata: { error: result.error },
        });
        // Não relança o erro: uma falha na OpenAI (ex: chave inválida, sem
        // crédito) não deve virar um retry automático em loop - o próximo
        // inbound do contato tentará de novo naturalmente.
        return { skipped: true, reason: result.error };
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          instanceId: conversation.instanceId,
          contactId: conversation.contactId,
          direction: "OUTBOUND",
          status: "QUEUED",
          content: result.text,
          metadata: { source: "ai_auto_reply" },
        },
      });

      await enqueueSendMessage({
        tenantId: conversation.tenantId,
        instanceId: conversation.instanceId,
        conversationId,
        contactId: conversation.contactId,
        content: result.text,
        idempotencyKey: randomUUID(),
      });

      // Tempo real (seção 36): a resposta da IA também é uma nova mensagem
      // na conversa - a tela de Conversas precisa saber.
      emitToTenant(conversation.tenantId, "conversation:message", { conversationId });

      await writeLog({
        tenantId: conversation.tenantId,
        action: "AI_REPLY_SENT",
        resource: "conversation",
        resourceId: conversationId,
        metadata: { messageId: message.id },
      });

      return { sent: true, messageId: message.id };
    },
    { connection: redisConnection, concurrency: 5 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[aiReply.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
