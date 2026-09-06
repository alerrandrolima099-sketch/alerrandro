import { prisma } from "@whatsapp-saas/database";
import { emitToTenant } from "../realtime/emitter";

/**
 * Registra uma mensagem que SAIU pelo WhatsApp do celular (instância
 * WHATSAPP_QR) mas não passou pela plataforma - ou seja, o atendente
 * respondeu o lead direto no aplicativo do WhatsApp, em vez de usar a caixa
 * "Escreva uma mensagem" da tela de Conversas.
 *
 * Por que isso é necessário: o evento "messages.upsert" do Baileys também
 * dispara para mensagens ENVIADAS por este número (fromMe: true) - tanto as
 * que a própria plataforma manda (botão Enviar, automação, resposta por IA)
 * quanto as digitadas manualmente no celular. As da plataforma já são
 * registradas ANTES de serem enviadas (ver conversations.service.ts,
 * automationEngine.ts, aiReply.processor.ts) - contá-las de novo aqui
 * duplicaria a mensagem. BaileysProvider já filtra essa duplicata (rastreia
 * os IDs que ele mesmo mandou, ver `sentMessageIds`) antes de chamar esta
 * função - só chega até aqui quem sobrou, ou seja, mensagens genuinamente
 * mandadas fora da plataforma.
 *
 * Sem isso, a tela de Conversas mostrava só o lado do lead - respostas
 * dadas direto no celular ficavam completamente invisíveis no histórico.
 */
export async function handleManualOutboundMessage(params: {
  instanceId: string;
  to: string;
  text: string;
  providerMsgId?: string;
}): Promise<void> {
  const instance = await prisma.instance.findUnique({ where: { id: params.instanceId } });
  if (!instance) return;

  const phone = params.to;
  if (!phone || !params.text) return;

  // Só registra quando já existe um Contact/Conversation conhecidos - uma
  // mensagem saindo do celular para um número que nunca foi um lead na
  // plataforma (ex: uma conversa pessoal do dono do número) não deveria
  // virar um "Contact"/"Conversation" do zero aqui.
  const contact = await prisma.contact.findUnique({
    where: { tenantId_phone: { tenantId: instance.tenantId, phone } },
  });
  if (!contact) return;

  const conversation = await prisma.conversation.findFirst({
    where: { instanceId: instance.id, contactId: contact.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!conversation) return;

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      instanceId: instance.id,
      contactId: contact.id,
      direction: "OUTBOUND",
      status: "DELIVERED",
      content: params.text,
      providerMsgId: params.providerMsgId,
      metadata: { source: "manual_phone_reply" },
    },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  // Tempo real (seção 36): mesmo evento usado para toda mensagem nova -
  // atualiza a tela de Conversas sem precisar de F5/polling.
  emitToTenant(instance.tenantId, "conversation:message", { conversationId: conversation.id });
}
