import { prisma } from "@whatsapp-saas/database";
import { getMessagingProvider, generateAiReply, writeLog } from "@whatsapp-saas/core";

/**
 * Aquecimento de números (seção 35): a cada TICK_INTERVAL_MS, olha todos os
 * WarmupPair ativos e, para os que já podem mandar a próxima mensagem
 * (nextMessageAt <= agora e ainda não bateram a meta diária), gera uma
 * mensagem curta e casual com a IA e manda de uma instância pra outra via
 * WhatsApp de verdade - simulando duas pessoas conversando organicamente.
 *
 * Deliberadamente NÃO usa a fila aiReplyQueue/handleInboundMessage (essa é
 * a IA que responde clientes de verdade, com ritmo de "atendimento" de
 * segundos). Aqui o ritmo é de minutos/horas - o objetivo é só gerar
 * atividade real e espaçada no número antes de usá-lo pra campanhas, não
 * simular um atendimento.
 *
 * Implementado como um setInterval simples dentro do processo worker (e não
 * como fila BullMQ) porque é um laço de checagem periódica sobre poucas
 * linhas no banco, não um trabalho por item - mantém a implementação bem
 * mais simples. Assume um único worker rodando o laço; se um dia o worker
 * escalar para múltiplas réplicas, isso teria que virar um job BullMQ
 * repetível com lock, para não duplicar envios.
 */

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const HISTORY_LIMIT = 10;

const WARMUP_SYSTEM_PROMPT = (persona?: string | null) =>
  persona?.trim() ||
  "Você está batendo papo casualmente no WhatsApp com um conhecido, como duas pessoas reais trocando mensagens do dia a dia. " +
    "Responda de forma bem curta (uma frase, às vezes só uma palavra ou emoji), natural e informal, em português do Brasil. " +
    "Varie o assunto: cumprimentos, perguntas sobre o dia, comentários soltos, memes de trabalho. " +
    "Nunca mencione que você é uma IA, um bot, ou que isso é um teste/automação.";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // "2026-09-02"
}

function randomMinutes(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

export function registerWarmupProcessor() {
  const timer = setInterval(() => {
    runWarmupTick().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[warmup.processor] tick falhou:", err);
    });
  }, TICK_INTERVAL_MS);
  // Não impede o processo de encerrar só por causa deste timer.
  timer.unref?.();
  return timer;
}

async function runWarmupTick() {
  const pairs = await prisma.warmupPair.findMany({
    where: { enabled: true },
    include: {
      instanceA: { include: { persona: true } },
      instanceB: { include: { persona: true } },
    },
  });

  const now = new Date();
  const today = todayKey();

  for (const pair of pairs) {
    try {
      // Zera o contador diário quando o dia virou.
      let sentToday = pair.sentToday;
      if (pair.dayKey !== today) {
        await prisma.warmupPair.update({ where: { id: pair.id }, data: { dayKey: today, sentToday: 0 } });
        sentToday = 0;
      }

      if (sentToday >= pair.dailyMessageTarget) continue;
      if (pair.nextMessageAt > now) continue;
      if (pair.instanceA.status !== "CONNECTED" || pair.instanceB.status !== "CONNECTED") continue;

      // Alterna o remetente: quem mandou por último não manda de novo agora.
      const senderIsA = pair.lastSenderInstanceId !== pair.instanceAId;
      const sender = senderIsA ? pair.instanceA : pair.instanceB;
      const receiver = senderIsA ? pair.instanceB : pair.instanceA;
      if (!receiver.phoneNumber) continue;

      const recentMessages = await prisma.warmupMessage.findMany({
        where: { warmupPairId: pair.id },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      });

      const history = recentMessages
        .slice()
        .reverse()
        .map((m) => ({
          role: (m.senderInstanceId === sender.id ? "assistant" : "user") as "assistant" | "user",
          content: m.content,
        }));

      if (history.length === 0) {
        history.push({ role: "user", content: "(comece a conversa com um cumprimento casual)" });
      }

      // Perfil de Conversa (seção 38): texto livre da instância continua
      // tendo prioridade quando preenchido; o Perfil é a alternativa
      // reutilizável quando não há texto livre configurado.
      const senderPrompt = sender.aiSystemPrompt ?? sender.persona?.systemPrompt ?? null;
      const result = await generateAiReply({ history, systemPrompt: WARMUP_SYSTEM_PROMPT(senderPrompt) });
      if (!result.ok) {
        await prisma.warmupPair.update({ where: { id: pair.id }, data: { lastError: result.error } });
        continue;
      }

      const provider = getMessagingProvider(sender.provider);
      const sendResult = await provider.sendTextMessage({
        instanceId: sender.id,
        to: receiver.phoneNumber,
        text: result.text,
        idempotencyKey: `warmup_${pair.id}_${now.getTime()}`,
      });

      if (sendResult.status === "FAILED") {
        await prisma.warmupPair.update({
          where: { id: pair.id },
          data: { lastError: sendResult.error ?? "Falha ao enviar mensagem de aquecimento" },
        });
        continue;
      }

      await prisma.warmupMessage.create({
        data: { warmupPairId: pair.id, senderInstanceId: sender.id, content: result.text },
      });

      await prisma.warmupPair.update({
        where: { id: pair.id },
        data: {
          lastSenderInstanceId: sender.id,
          sentToday: { increment: 1 },
          nextMessageAt: new Date(
            now.getTime() + randomMinutes(pair.minIntervalMinutes, pair.maxIntervalMinutes) * 60 * 1000
          ),
          lastError: null,
        },
      });

      await writeLog({
        tenantId: pair.tenantId,
        action: "WARMUP_MESSAGE_SENT",
        resource: "warmup_pair",
        resourceId: pair.id,
        metadata: { from: sender.id, to: receiver.id },
      });
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error(`[warmup.processor] falha no par ${pair.id}:`, err);
    }
  }
}
