// Carrega e valida variáveis de ambiente compartilhadas por api e worker.
// Nunca importe secrets diretamente - sempre passe por aqui.

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",

  DATABASE_URL: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/whatsapp_saas"),
  REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),

  JWT_SECRET: required("JWT_SECRET", "dev-only-change-me"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-only-change-me-refresh"),
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",

  MESSAGING_PROVIDER: process.env.MESSAGING_PROVIDER ?? "MOCK", // MOCK | WHATSAPP_CLOUD_API | WHATSAPP_QR
  MESSAGING_API_URL: process.env.MESSAGING_API_URL ?? "",
  MESSAGING_API_TOKEN: process.env.MESSAGING_API_TOKEN ?? "",

  // Diretório onde as credenciais de sessão do WHATSAPP_QR (Baileys) ficam
  // persistidas. Em produção, defina BAILEYS_SESSIONS_DIR apontando para o
  // caminho de montagem de um Volume do Railway anexado ao serviço worker
  // (ex: /data/baileys-sessions) - sem isso, a sessão se perde a cada
  // deploy/restart e o usuário precisa escanear o QR Code de novo. O
  // padrão abaixo (/tmp) só é seguro para desenvolvimento local.
  BAILEYS_SESSIONS_DIR: process.env.BAILEYS_SESSIONS_DIR ?? "/tmp/baileys-sessions",

  // Resposta automática por IA (ChatGPT/OpenAI) nas Conversas - seção 34.
  // Sem OPENAI_API_KEY definida, a funcionalidade fica automaticamente
  // desligada (fail-safe: nunca tenta chamar a OpenAI sem chave configurada).
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
  OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // Atraso (ms) antes de enviar a resposta da IA - simula tempo de digitação
  // humano e evita respostas instantâneas (padrão que aumenta o risco de
  // bloqueio em instâncias WHATSAPP_QR, além de parecer robótico).
  AI_REPLY_DELAY_MIN_MS: Number(process.env.AI_REPLY_DELAY_MIN_MS ?? 3000),
  AI_REPLY_DELAY_MAX_MS: Number(process.env.AI_REPLY_DELAY_MAX_MS ?? 9000),
  // Limite de respostas automáticas por conversa por hora - trava de
  // segurança contra loops/custos inesperados com a API da OpenAI.
  AI_REPLY_MAX_PER_HOUR: Number(process.env.AI_REPLY_MAX_PER_HOUR ?? 30),

  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? "dev-only-webhook-secret",
  ENCRYPTION_KEY: required("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"), // 32 bytes p/ AES-256

  API_PORT: Number(process.env.API_PORT ?? 4000),
  WEB_PORT: Number(process.env.WEB_PORT ?? 3000),
  // Aceita uma lista separada por vírgula (ex: "https://a.com,https://b.com")
  // em vez de uma única origem fixa - necessário porque o frontend pode ser
  // acessado por mais de um domínio ao mesmo tempo (o domínio gerado pela
  // Railway, o domínio próprio com e sem "www", etc). Tanto o pacote `cors`
  // quanto o `socket.io` aceitam um array de origens permitidas aqui.
  CORS_ORIGIN: (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Configuração inicial (Fase 33: não é um limite fixo da arquitetura, apenas seed).
  DEFAULT_SESSION_STEP_DURATION_SEC: Number(process.env.DEFAULT_SESSION_STEP_DURATION_SEC ?? 60),
};
