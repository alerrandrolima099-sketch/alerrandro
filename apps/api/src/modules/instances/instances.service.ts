import { prisma } from "../../lib/prisma";
import { getMessagingProvider } from "../../messaging";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";
import { encrypt } from "../../lib/encryption";

/**
 * Instance = camada de negócio da entidade Instance.
 * Toda operação de conexão real é delegada ao MessagingProvider (seção 6),
 * nunca implementada diretamente aqui.
 */
export class InstancesService {
  async list(tenantId: string) {
    return prisma.instance.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
  }

  async getById(tenantId: string, id: string) {
    const instance = await prisma.instance.findFirst({ where: { id, tenantId } });
    if (!instance) throw new AppError(404, "Instância não encontrada");
    return instance;
  }

  async create(tenantId: string, params: { name: string; providerConfig?: Record<string, unknown> }) {
    const instance = await prisma.instance.create({
      data: {
        tenantId,
        name: params.name,
        status: "DISCONNECTED",
        providerConfig: params.providerConfig ? encrypt(JSON.stringify(params.providerConfig)) : undefined,
      },
    });
    await writeLog({ tenantId, action: "INSTANCE_CREATED", resource: "instance", resourceId: instance.id });
    return instance;
  }

  async connect(tenantId: string, id: string) {
    const instance = await this.getById(tenantId, id);
    await prisma.instance.update({ where: { id: instance.id }, data: { status: "CONNECTING" } });

    const provider = getMessagingProvider();
    const result = await provider.connectInstance(instance.id);

    const updated = await prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: result.status,
        lastError: result.error ?? null,
        lastActivityAt: new Date(),
      },
    });

    await writeLog({ tenantId, action: "INSTANCE_CONNECT_ATTEMPT", resource: "instance", resourceId: instance.id, metadata: { status: result.status } });
    return updated;
  }

  async disconnect(tenantId: string, id: string) {
    const instance = await this.getById(tenantId, id);
    const provider = getMessagingProvider();
    await provider.disconnectInstance(instance.id);

    const updated = await prisma.instance.update({
      where: { id: instance.id },
      data: { status: "DISCONNECTED", lastActivityAt: new Date() },
    });
    await writeLog({ tenantId, action: "INSTANCE_DISCONNECTED", resource: "instance", resourceId: instance.id });
    return updated;
  }

  async pause(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    return prisma.instance.update({ where: { id }, data: { status: "PAUSED" } });
  }

  async remove(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    await prisma.instance.delete({ where: { id } });
    await writeLog({ tenantId, action: "INSTANCE_DELETED", resource: "instance", resourceId: id });
  }
}

export const instancesService = new InstancesService();
