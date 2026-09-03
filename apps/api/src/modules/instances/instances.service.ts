import { prisma } from "../../lib/prisma";
import { getMessagingProvider, enqueueInstanceConnect } from "../../messaging";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";
import { encrypt } from "../../lib/encryption";
import { attachInstanceStats } from "./instanceHealth";
import type { MessagingProviderType } from "@whatsapp-saas/database";

/**
 * Instance = camada de negócio da entidade Instance.
 * Toda operação de conexão real é delegada ao MessagingProvider (seção 6),
 * nunca implementada diretamente aqui.
 */
export class InstancesService {
  /** Lista "Meus Números" (seção 39) - cada instância já vem com saúde,
   * nível de aquecimento, dias aquecendo, grupos, mensagens e evolução. */
  async list(tenantId: string) {
    const instances = await prisma.instance.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } });
    return attachInstanceStats(tenantId, instances);
  }

  /** Lookup interno leve (sem estatísticas) - usado por connect/disconnect/
   * pause/remove/updateAiSettings, que só precisam confirmar que a
   * instância existe e pertence ao tenant antes de agir. */
  async getById(tenantId: string, id: string) {
    const instance = await prisma.instance.findFirst({ where: { id, tenantId } });
    if (!instance) throw new AppError(404, "Instância não encontrada");
    return instance;
  }

  /** Usado pela rota GET /:id (card/detalhe de um número) - mesma
   * instância, enriquecida com as mesmas estatísticas da listagem. */
  async getByIdWithStats(tenantId: string, id: string) {
    const instance = await this.getById(tenantId, id);
    const [withStats] = await attachInstanceStats(tenantId, [instance]);
    return withStats;
  }

  async create(
    tenantId: string,
    params: { name: string; provider?: MessagingProviderType; providerConfig?: Record<string, unknown> }
  ) {
    const instance = await prisma.instance.create({
      data: {
        tenantId,
        name: params.name,
        status: "DISCONNECTED",
        provider: params.provider ?? "MOCK",
        providerConfig: params.providerConfig ? encrypt(JSON.stringify(params.providerConfig)) : undefined,
      },
    });
    await writeLog({ tenantId, action: "INSTANCE_CREATED", resource: "instance", resourceId: instance.id });
    return instance;
  }

  // phoneNumber (opcional): quando informado, pede um código de pareamento
  // (letras+números) pra esse número em vez de gerar QR Code - segunda forma
  // de conectar uma instância WHATSAPP_QR, oferecida pelo próprio WhatsApp
  // (Aparelhos conectados → Conectar com número de telefone). Ignorado por
  // qualquer outro provedor.
  async connect(tenantId: string, id: string, phoneNumber?: string) {
    const instance = await this.getById(tenantId, id);

    // WHATSAPP_QR precisa gerar e aguardar a leitura do QR Code (ou a
    // digitação do código de pareamento), o que só acontece de fato dentro
    // do processo worker (é lá que o socket do Baileys vive). A API apenas
    // enfileira e marca como CONNECTING - o front-end faz polling em GET
    // /instances/:id até o qrCode/pairingCode aparecer.
    if (instance.provider === "WHATSAPP_QR") {
      const trimmedPhone = phoneNumber?.trim() || undefined;
      const updated = await prisma.instance.update({
        where: { id: instance.id },
        data: { status: "CONNECTING", lastError: null, lastActivityAt: new Date() },
      });
      await enqueueInstanceConnect({ instanceId: instance.id, phoneNumber: trimmedPhone });
      await writeLog({
        tenantId,
        action: "INSTANCE_CONNECT_ATTEMPT",
        resource: "instance",
        resourceId: instance.id,
        metadata: { status: "CONNECTING", async: true, method: trimmedPhone ? "pairing_code" : "qr_code" },
      });
      return updated;
    }

    await prisma.instance.update({ where: { id: instance.id }, data: { status: "CONNECTING" } });

    const provider = getMessagingProvider(instance.provider);
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
    const provider = getMessagingProvider(instance.provider);
    await provider.disconnectInstance(instance.id);

    const updated = await prisma.instance.update({
      where: { id: instance.id },
      data: { status: "DISCONNECTED", lastActivityAt: new Date() },
    });
    await writeLog({ tenantId, action: "INSTANCE_DISCONNECTED", resource: "instance", resourceId: instance.id });
    return updated;
  }

  /**
   * Liga/desliga a resposta automática por IA (ChatGPT) desta instância e/ou
   * atualiza a persona (prompt de sistema) usada nas respostas - seção 34.
   */
  async updateAiSettings(
    tenantId: string,
    id: string,
    params: { aiAutoReplyEnabled?: boolean; aiSystemPrompt?: string | null; personaId?: string | null }
  ) {
    await this.getById(tenantId, id);

    if (params.personaId) {
      const persona = await prisma.persona.findFirst({ where: { id: params.personaId, tenantId } });
      if (!persona) throw new AppError(404, "Perfil de conversa não encontrado");
    }

    const updated = await prisma.instance.update({
      where: { id },
      data: {
        ...(params.aiAutoReplyEnabled !== undefined ? { aiAutoReplyEnabled: params.aiAutoReplyEnabled } : {}),
        ...(params.aiSystemPrompt !== undefined ? { aiSystemPrompt: params.aiSystemPrompt } : {}),
        ...(params.personaId !== undefined ? { personaId: params.personaId } : {}),
      },
    });
    await writeLog({
      tenantId,
      action: "INSTANCE_AI_SETTINGS_UPDATED",
      resource: "instance",
      resourceId: id,
      metadata: params,
    });
    return updated;
  }

  async pause(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    return prisma.instance.update({ where: { id }, data: { status: "PAUSED" } });
  }

  // Apelido livre do aparelho físico onde esse número está conectado (seção
  // 43) - ex: "iPhone 17 Pro Max". Puramente informativo/organizacional,
  // não afeta a conexão real com o WhatsApp.
  async updateDeviceLabel(tenantId: string, id: string, deviceLabel: string | null) {
    await this.getById(tenantId, id);
    const trimmed = deviceLabel?.trim();
    const updated = await prisma.instance.update({
      where: { id },
      data: { deviceLabel: trimmed ? trimmed : null },
    });
    await writeLog({
      tenantId,
      action: "INSTANCE_DEVICE_LABEL_UPDATED",
      resource: "instance",
      resourceId: id,
      metadata: { deviceLabel: trimmed ?? null },
    });
    return updated;
  }

  // Apelido livre de qual WhatsApp/clone esse número usa no aparelho (seção
  // 43) - ex: "whatsapp-2", quando a pessoa usa apps de clonagem/espaço
  // paralelo pra ter vários WhatsApp no mesmo celular. Mesmo padrão do
  // updateDeviceLabel acima, só que pra essa outra informação.
  async updateWhatsappLabel(tenantId: string, id: string, whatsappLabel: string | null) {
    await this.getById(tenantId, id);
    const trimmed = whatsappLabel?.trim();
    const updated = await prisma.instance.update({
      where: { id },
      data: { whatsappLabel: trimmed ? trimmed : null },
    });
    await writeLog({
      tenantId,
      action: "INSTANCE_WHATSAPP_LABEL_UPDATED",
      resource: "instance",
      resourceId: id,
      metadata: { whatsappLabel: trimmed ?? null },
    });
    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    await prisma.instance.delete({ where: { id } });
    await writeLog({ tenantId, action: "INSTANCE_DELETED", resource: "instance", resourceId: id });
  }
}

export const instancesService = new InstancesService();
