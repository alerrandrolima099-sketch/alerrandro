"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.senderPoolService = exports.SenderPoolService = void 0;
const crypto_1 = require("crypto");
const database_1 = require("@whatsapp-saas/database");
const redis_1 = require("../redis");
const errors_1 = require("../errors");
/**
 * Message Sender Pool (seção 7).
 *
 * Algoritmo de distribuição:
 *  1. Verificar senders AVAILABLE e ativos do tenant/instância.
 *  2. Selecionar um elegível (menor lastUsedAt = round-robin simples).
 *  3. Tentar um LOCK atômico no Redis para esse sender (evita condição de
 *     corrida entre requisições concorrentes tentando pegar o mesmo número).
 *  4. Se o lock for obtido, marcar sender como BUSY no banco e criar a sessão.
 *  5. Ao finalizar a sessão -> release() libera o sender (AVAILABLE) e o lock.
 *
 * O lock Redis é o mecanismo que garante que duas sessões incompatíveis
 * nunca usem o mesmo sender simultaneamente (seção 7).
 */
const LOCK_TTL_SEC = 60 * 30; // trava expira em 30min como salvaguarda (evita deadlock por crash)
function lockKey(senderId) {
    return `sender-lock:${senderId}`;
}
class SenderPoolService {
    /** Tenta reservar um sender disponível para o tenant/instância informado. */
    async acquireSender(tenantId, instanceId) {
        const candidates = await database_1.prisma.sender.findMany({
            where: {
                isActive: true,
                status: "AVAILABLE",
                instance: { id: instanceId, tenantId },
            },
            orderBy: { lastUsedAt: "asc" }, // round-robin: o menos usado recentemente primeiro
        });
        for (const sender of candidates) {
            const token = (0, crypto_1.randomUUID)();
            // SET NX com expiração: só um processo consegue "vencer" o lock.
            const acquired = await redis_1.redisConnection.set(lockKey(sender.id), token, "EX", LOCK_TTL_SEC, "NX");
            if (acquired === "OK") {
                const updated = await database_1.prisma.sender.update({
                    where: { id: sender.id },
                    data: { status: "BUSY", lastUsedAt: new Date() },
                });
                return { sender: updated, lockToken: token };
            }
            // Não conseguiu o lock (outra requisição concorrente venceu) - tenta o próximo.
        }
        return null; // nenhum sender disponível no momento
    }
    /** Libera um sender previamente adquirido, validando o token do lock. */
    async releaseSender(senderId, lockToken) {
        const currentToken = await redis_1.redisConnection.get(lockKey(senderId));
        if (currentToken !== lockToken) {
            // Lock já expirou ou pertence a outro processo - não libera às cegas.
            throw new errors_1.AppError(409, "Lock inválido ou expirado para este sender");
        }
        await redis_1.redisConnection.del(lockKey(senderId));
        await database_1.prisma.sender.update({ where: { id: senderId }, data: { status: "AVAILABLE" } });
    }
    async pause(tenantId, senderId) {
        return database_1.prisma.sender.update({
            where: { id: senderId, instance: { tenantId } },
            data: { status: "PAUSED" },
        });
    }
    async markError(senderId) {
        return database_1.prisma.sender.update({ where: { id: senderId }, data: { status: "ERROR" } });
    }
    async list(tenantId) {
        return database_1.prisma.sender.findMany({ where: { instance: { tenantId } } });
    }
}
exports.SenderPoolService = SenderPoolService;
exports.senderPoolService = new SenderPoolService();
