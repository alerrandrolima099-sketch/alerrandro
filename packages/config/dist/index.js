"use strict";
// Carrega e valida variáveis de ambiente compartilhadas por api e worker.
// Nunca importe secrets diretamente - sempre passe por aqui.
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
exports.env = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
    DATABASE_URL: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/whatsapp_saas"),
    REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),
    JWT_SECRET: required("JWT_SECRET", "dev-only-change-me"),
    JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET", "dev-only-change-me-refresh"),
    JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
    MESSAGING_PROVIDER: process.env.MESSAGING_PROVIDER ?? "MOCK", // MOCK | WHATSAPP_CLOUD_API
    MESSAGING_API_URL: process.env.MESSAGING_API_URL ?? "",
    MESSAGING_API_TOKEN: process.env.MESSAGING_API_TOKEN ?? "",
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET ?? "dev-only-webhook-secret",
    ENCRYPTION_KEY: required("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"), // 32 bytes p/ AES-256
    API_PORT: Number(process.env.API_PORT ?? 4000),
    WEB_PORT: Number(process.env.WEB_PORT ?? 3000),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    // Configuração inicial (Fase 33: não é um limite fixo da arquitetura, apenas seed).
    DEFAULT_SESSION_STEP_DURATION_SEC: Number(process.env.DEFAULT_SESSION_STEP_DURATION_SEC ?? 60),
};
