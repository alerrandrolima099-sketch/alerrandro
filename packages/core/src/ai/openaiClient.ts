import { env } from "@whatsapp-saas/config";

/**
 * Cliente mínimo para a Chat Completions API da OpenAI (seção 34: IA
 * respondendo automaticamente nas Conversas). Usa fetch puro (sem SDK) -
 * mesmo padrão já usado em WhatsAppCloudProvider - para não depender de
 * mais um pacote npm e manter o comportamento explícito.
 *
 * NUNCA usar em produção sem OPENAI_API_KEY configurada; chamadas falham de
 * forma explícita (fail-fast) - nunca simulamos uma resposta.
 */

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateReplyResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const DEFAULT_SYSTEM_PROMPT =
  "Você é um atendente virtual educado e objetivo de uma empresa via WhatsApp. " +
  "Responda de forma curta (no máximo 2-3 frases), clara e cordial, em português do Brasil. " +
  "Se não souber a resposta ou o assunto exigir um humano (financeiro, reclamação grave, dado sensível), " +
  "diga que vai encaminhar para um atendente humano em vez de inventar uma resposta.";

/**
 * Gera uma resposta da IA para uma conversa, dado o histórico de mensagens
 * (mais antiga primeiro) e um prompt de sistema opcional (persona).
 */
export async function generateAiReply(params: {
  history: AiChatMessage[];
  systemPrompt?: string | null;
}): Promise<GenerateReplyResult> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY não configurada" };
  }

  const messages: AiChatMessage[] = [
    { role: "system", content: params.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT },
    ...params.history,
  ];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages,
        temperature: 0.6,
        max_tokens: 400,
      }),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: "Resposta vazia da OpenAI" };
    }

    return { ok: true, text };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
