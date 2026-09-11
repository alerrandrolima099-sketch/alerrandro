import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { enqueueSendMessage } from "../../queues/queueService";
import { writeLog } from "../../lib/logger";
import { emitToTenant } from "../../websocket/gateway";
import { randomUUID } from "crypto";

export class ConversationsService {
  async list(tenantId: string) {
    return prisma.conversation.findMany({
      // Número marcado como "em uso no Leona" (Instance.inUseLeona, seção
      // 45/48) fica de fora da tela de Conversas - mesma regra já aplicada
      // pra elegibilidade de grupos (ver groups.service.ts): enquanto o
      // usuário estiver operando aquele número por fora, pela ferramenta
      // Leona, ele não aparece aqui pra evitar os dois lados mexendo na
      // mesma conversa ao mesmo tempo. Nada é apagado - a conversa só some
      // da lista enquanto o marcador estiver ligado, e volta a aparecer se
      // for desmarcado em Meus Números.
      where: { tenantId, instance: { inUseLeona: false } },
      include: { contact: true, instance: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getMessages(tenantId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");

    // Abrir a conversa na tela marca como lida (seção 45) - só grava se
    // havia algo pra marcar, pra não gerar updatedAt/eventos à toa.
    if (conversation.unread) {
      await prisma.conversation.update({ where: { id: conversationId }, data: { unread: false } });
    }

    return prisma.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
  }

  /** Cria (ou reaproveita) a conversa entre uma instância e um contato, para o botão "Nova conversa" (seção 45). */
  async start(tenantId: string, instanceId: string, contactId: string) {
    const instance = await prisma.instance.findFirst({ where: { id: instanceId, tenantId } });
    if (!instance) throw new AppError(404, "Instância não encontrada");
    if (instance.inUseLeona) {
      throw new AppError(422, 'Este número está marcado como "em uso no Leona" - não pode ser usado em Conversas enquanto estiver marcado.');
    }
    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact) throw new AppError(404, "Contato não encontrado");

    let conversation = await prisma.conversation.findFirst({ where: { instanceId, contactId } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { tenantId, instanceId, contactId } });
      await writeLog({ tenantId, action: "CONVERSATION_STARTED", resource: "conversation", resourceId: conversation.id });
    }

    return prisma.conversation.findFirst({
      where: { id: conversation.id },
      include: { contact: true, instance: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
  }

  /** Move o ticket entre as abas Aguardando/Atendendo/Resolvidos (seção 45) - ação manual do atendente. */
  async setTicketStatus(tenantId: string, conversationId: string, status: "AGUARDANDO" | "ATENDENDO" | "RESOLVIDO") {
    const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, tenantId } });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    await writeLog({
      tenantId,
      action: "CONVERSATION_STATUS_CHANGED",
      resource: "conversation",
      resourceId: conversationId,
      metadata: { from: conversation.ticketStatus, to: status },
    });
    return prisma.conversation.update({ where: { id: conversationId }, data: { ticketStatus: status } });
  }

  /** Envio manual (atendimento humano) - passa pela mesma fila que a automação. */
  async sendManualMessage(tenantId: string, conversationId: string, content: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { contact: true, instance: true },
    });
    if (!conversation) throw new AppError(404, "Conversa não encontrada");
    if (conversation.contact.status !== "ACTIVE") {
      throw new AppError(422, "Contato sem consentimento ativo - envio bloqueado");
    }
    // Trava de segurança (seção 45): mesma regra do list() acima - se o
    // número foi marcado "em uso no Leona" depois que a tela já estava
    // aberta, bloqueia o envio em vez de confiar só no filtro da listagem.
    if (conversation.instance.inUseLeona) {
      throw new AppError(422, 'Este número está marcado como "em uso no Leona" - envio bloqueado enquanto estiver marcado.');
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

    // Primeira resposta manual de um ticket que ainda estava só "Aguardando"
    // já move pra "Atendendo" sozinho (seção 45) - evita o atendente ter que
    // lembrar de mudar a aba toda vez que começa a atender um ticket novo.
    if (conversation.ticketStatus === "AGUARDANDO") {
      await prisma.conversation.update({ where: { id: conversationId }, data: { ticketStatus: "ATENDENDO" } });
    }

    await enqueueSendMessage({
      tenantId,
      instanceId: conversation.instanceId,
      conversationId,
      contactId: conversation.contactId,
      content,
      idempotencyKey: randomUUID(),
    });

    // Tempo real (seção 36): envio manual (atendimento humano) também conta
    // como novidade na conversa para quem estiver com a tela aberta em
    // outra aba/sessão.
    emitToTenant(tenantId, "conversation:message", { conversationId });

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
