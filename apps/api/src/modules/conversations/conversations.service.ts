import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { enqueueSendMessage } from "../../queues/queueService";
import { writeLog } from "../../lib/logger";
import { randomUUID } from "crypto";

export class ConversationsService {
  async list(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId },
      include: { contact: true, instance: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getMessages(tenantId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  /** Envio manual (atendimento humano) - passa pela mesma fila que a automação. */
  async sendManualMessage(tenantId: string, conversationId: string, content: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true },
    });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    if (conversation.contact.status !== "ACTIVE") {
      throw new AppError(422, "Contato sem consentimento ativo - envio bloqueado");
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        instanceId: conversation.instanceId,
        contactId: conversation.contactId,
        direction: "OUTBOUND",
        status: "QUEUED",
        content,
      },
    });

    await enqueueSendMessage({
      tenantId,
      instanceId: conversation.instanceId,
      conversationId,
      contactId: conversation.contactId,
      content,
      idempotencyKey: randomUUID(),
    });

    return message;
  }

  async pauseAutomation(tenantId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    await writeLog({ tenantId, action: "AUTOMATION_PAUSED", resource: "conversation", resourceId: conversationId });
    return prisma.conversation.update({ where: { id: conversationId }, data: { automationPaused: true } });
  }

  async resumeAutomation(tenantId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    await writeLog({ tenantId, action: "AUTOMATION_RESUMED", resource: "conversation", resourceId: conversationId });
    return prisma.conversation.update({ where: { id: conversationId }, data: { automationPaused: false } });
  }
}

export const conversationsService = new ConversationsService();
