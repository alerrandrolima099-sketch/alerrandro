import { prisma } from "@whatsapp-saas/database";
import { env } from "@whatsapp-saas/config";
import { automationEngine } from "../automation/automationEngine";
import { enqueueAiReply } from "../queues/queueService";
import { emitToTenant } from "../realtime/emitter";

/**
 * Ponto único de entrada para QUALQUER mensagem recebida de um contato,
 * não importa o provedor (WhatsApp Business Cloud API via webhook, ou
 * WHATSAPP_QR via evento "messages.upsert" do Baileys).
 *
 * Responsabilidades (seção 34):
 *   1. Garante que Contact e Conversation existem (cria se for a primeira
 *      mensagem desse número - antes disso a mensagem era descartada
 *      silenciosamente se não houvesse conversa pré-existente).
 *   2. Registra a mensagem INBOUND.
 *   3. Se houver uma automação (fluxo visual) esperando resposta deste
 *      contato, ela tem prioridade (comportamento already existente).
 *   4. Caso contrário, se a instância tiver resposta automática por IA
 *      habilitada e a conversa não estiver pausada (atendimento humano
 *      assumiu), enfileira uma resposta da IA com um atraso (para simular
 *      tempo de digitação e evitar respostas instantâneas).
 */
export async function handleInboundMessage(params: {
  instanceId: string;
  from: string;
  text: string;
  providerMsgId?: string;
}): Promise<void> {
  const instance = await prisma.instance.findUnique({ where: { id: params.instanceId } });
  if (!instance) return;

  const phone = params.from;
  if (!phone || !params.text) return;

  // Tráfego do aquecimento de números (seção 35): quando esta mensagem vem
  // do número de uma instância parceira de aquecimento ATIVA, ignora aqui -
  // o warmup.processor.ts já controla os dois lados da conversa sozinho
  // (histórico, alternância, ritmo). Sem isso, essa mesma mensagem também
  // cairia no fluxo normal de cliente (criaria Contact/Conversation "de
  // verdade" e, se a IA de atendimento estiver ligada, geraria uma segunda
  // resposta concorrente e fora do ritmo pensado para aquecimento).
  const warmupPairs = await prisma.warmupPair.findMany({
    where: { enabled: true, OR: [{ instanceAId: instance.id }, { instanceBId: instance.id }] },
    include: { instanceA: true, instanceB: true },
  });
  const fromDigits = phone.replace(/\D/g, "");
  const isWarmupTraffic = warmupPairs.some((pair) => {
    const partner = pair.instanceAId === instance.id ? pair.instanceB : pair.instanceA;
    return !!partner.phoneNumber && partner.phoneNumber.replace(/\D/g, "") === fromDigits;
  });
  if (isWarmupTraffic) return;

  const contact = await prisma.contact.upsert({
    where: { tenantId_phone: { tenantId: instance.tenantId, phone } },
    update: { lastInteraction: new Date() },
    create: {
      tenantId: instance.tenantId,
      name: phone,
      phone,
      status: "ACTIVE",
      origin: "inbound_message",
      lastInteraction: new Date(),
    },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { instanceId: instance.id, contactId: contact.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { tenantId: instance.tenantId, instanceId: instance.id, contactId: contact.id },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      instanceId: instance.id,
      contactId: contact.id,
      direction: "INBOUND",
      status: "DELIVERED",
      content: params.text,
      providerMsgId: params.providerMsgId,
    },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  // Tempo real (seção 36): avisa o front-end (tela de Conversas) que essa
  // conversa tem novidade, pra ele atualizar sem precisar de F5/polling.
  emitToTenant(instance.tenantId, "conversation:message", { conversationId: conversation.id });

  // Fluxo de automação (seção 14) tem prioridade sobre a IA genérica -
  // evita as duas coisas responderem ao mesmo tempo.
  const session = await prisma.session.findFirst({
    where: { contactId: contact.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (session) {
    await automationEngine.resumeAfterReply(session.id);
    return;
  }

  if (!instance.aiAutoReplyEnabled || conversation.automationPaused || contact.status !== "ACTIVE") {
    return;
  }

  // Trava de segurança: nunca deixa a IA mandar mais que AI_REPLY_MAX_PER_HOUR
  // mensagens na mesma conversa numa janela de 1h (evita custo/spam em loop).
  const recentAiReplies = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentAiReplies >= env.AI_REPLY_MAX_PER_HOUR) return;

  const span = Math.max(0, env.AI_REPLY_DELAY_MAX_MS - env.AI_REPLY_DELAY_MIN_MS);
  const delayMs = env.AI_REPLY_DELAY_MIN_MS + Math.floor(Math.random() * (span + 1));
  await enqueueAiReply({ conversationId: conversation.id }, delayMs);
}
