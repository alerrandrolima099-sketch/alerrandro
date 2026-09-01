import { randomUUID } from "crypto";
import { prisma } from "@whatsapp-saas/database";
import { redisConnection } from "../redis";
import { AppError } from "../errors";

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

function lockKey(senderId: string) {
  return `sender-lock:${senderId}`;
}

export class SenderPoolService {
  /** Tenta reservar um sender disponível para o tenant/instância informado. */
  async acquireSender(tenantId: string, instanceId: string) {
    const candidates = await prisma.sender.findMany({
      where: {
        isActive: true,
        status: "AVAILABLE",
        instance: { id: instanceId, tenantId },
      },
      orderBy: { lastUsedAt: "asc" }, // round-robin: o menos usado recentemente primeiro
    });

    for (const sender of candidates) {
      const token = randomUUID();
      // SET NX com expiração: só um processo consegue "vencer" o lock.
      const acquired = await redisConnection.set(lockKey(sender.id), token, "EX", LOCK_TTL_SEC, "NX");
      if (acquired === "OK") {
        const updated = await prisma.sender.update({
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
  async releaseSender(senderId: string, lockToken: string) {
    const currentToken = await redisConnection.get(lockKey(senderId));
    if (currentToken !== lockToken) {
      // Lock já expirou ou pertence a outro processo - não libera às cegas.
      throw new AppError(409, "Lock inválido ou expirado para este sender");
    }
    await redisConnection.del(lockKey(senderId));
    await prisma.sender.update({ where: { id: senderId }, data: { status: "AVAILABLE" } });
  }

  async pause(tenantId: string, senderId: string) {
    return prisma.sender.update({
      where: { id: senderId, instance: { tenantId } as any },
      data: { status: "PAUSED" },
    });
  }

  async markError(senderId: string) {
    return prisma.sender.update({ where: { id: senderId }, data: { status: "ERROR" } });
  }

  async list(tenantId: string) {
    return prisma.sender.findMany({ where: { instance: { tenantId } } });
  }
}

export const senderPoolService = new SenderPoolService();
