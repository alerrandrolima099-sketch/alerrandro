import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";

/**
 * Aquecimento de números (seção 35) - camada de negócio. O envio de fato
 * acontece no worker (warmup.processor.ts); aqui só cadastramos os pares e
 * suas configurações.
 */
export class WarmupService {
  async list(tenantId: string) {
    return prisma.warmupPair.findMany({
      where: { tenantId },
      include: {
        instanceA: { select: { id: true, name: true, phoneNumber: true, status: true, provider: true } },
        instanceB: { select: { id: true, name: true, phoneNumber: true, status: true, provider: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    tenantId: string,
    params: {
      instanceAId: string;
      instanceBId: string;
      dailyMessageTarget?: number;
      minIntervalMinutes?: number;
      maxIntervalMinutes?: number;
    }
  ) {
    if (params.instanceAId === params.instanceBId) {
      throw new AppError(422, "Escolha duas instâncias diferentes");
    }

    const [instanceA, instanceB] = await Promise.all([
      prisma.instance.findFirst({ where: { id: params.instanceAId, tenantId } }),
      prisma.instance.findFirst({ where: { id: params.instanceBId, tenantId } }),
    ]);
    if (!instanceA || !instanceB) throw new AppError(404, "Instância não encontrada");

    const pair = await prisma.warmupPair.create({
      data: {
        tenantId,
        instanceAId: params.instanceAId,
        instanceBId: params.instanceBId,
        dailyMessageTarget: params.dailyMessageTarget ?? 20,
        minIntervalMinutes: params.minIntervalMinutes ?? 20,
        maxIntervalMinutes: params.maxIntervalMinutes ?? 90,
      },
    });
    await writeLog({ tenantId, action: "WARMUP_PAIR_CREATED", resource: "warmup_pair", resourceId: pair.id });
    return pair;
  }

  async update(
    tenantId: string,
    id: string,
    params: {
      enabled?: boolean;
      dailyMessageTarget?: number;
      minIntervalMinutes?: number;
      maxIntervalMinutes?: number;
    }
  ) {
    const existing = await prisma.warmupPair.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Par de aquecimento não encontrado");

    const updated = await prisma.warmupPair.update({
      where: { id },
      data: {
        ...(params.enabled !== undefined ? { enabled: params.enabled } : {}),
        ...(params.dailyMessageTarget !== undefined ? { dailyMessageTarget: params.dailyMessageTarget } : {}),
        ...(params.minIntervalMinutes !== undefined ? { minIntervalMinutes: params.minIntervalMinutes } : {}),
        ...(params.maxIntervalMinutes !== undefined ? { maxIntervalMinutes: params.maxIntervalMinutes } : {}),
      },
    });
    await writeLog({
      tenantId,
      action: "WARMUP_PAIR_UPDATED",
      resource: "warmup_pair",
      resourceId: id,
      metadata: params,
    });
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const existing = await prisma.warmupPair.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Par de aquecimento não encontrado");
    await prisma.warmupPair.delete({ where: { id } });
    await writeLog({ tenantId, action: "WARMUP_PAIR_DELETED", resource: "warmup_pair", resourceId: id });
  }

  async recentMessages(tenantId: string, id: string) {
    const existing = await prisma.warmupPair.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Par de aquecimento não encontrado");
    return prisma.warmupMessage.findMany({
      where: { warmupPairId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }
}

export const warmupService = new WarmupService();
