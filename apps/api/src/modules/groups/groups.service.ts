import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { getMessagingProvider } from "../../messaging";
import { writeLog } from "../../lib/logger";

/**
 * Grupos/comunidades (seção 15). Fluxo obrigatório:
 * atendimento concluído -> verificar consentimento -> oferecer comunidade ->
 * contato aceita -> enviar convite oficial -> registrar evento.
 * NUNCA adiciona contatos automaticamente a um grupo.
 */
export class GroupsService {
  async list(tenantId: string) {
    return prisma.group.findMany({ where: { tenantId, isActive: true } });
  }

  async create(tenantId: string, params: { name: string; description?: string; inviteLink: string; category?: string }) {
    return prisma.group.create({ data: { tenantId, ...params } });
  }

  async offerInvite(tenantId: string, contactId: string, groupId: string) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } });
    if (!contact || contact.status !== "ACTIVE") {
      throw new AppError(422, "Contato sem consentimento ativo - convite não pode ser oferecido");
    }
    await prisma.invite.create({ data: { contactId, groupId, event: "INVITE_OFFERED" } });
  }

  async recordDecision(tenantId: string, contactId: string, groupId: string, accepted: boolean) {
    await prisma.invite.create({ data: { contactId, groupId, event: accepted ? "INVITE_ACCEPTED" : "INVITE_DECLINED" } });

    if (!accepted) return;

    const [contact, group] = await Promise.all([
      prisma.contact.findFirstOrThrow({ where: { id: contactId, tenantId } }),
      prisma.group.findFirstOrThrow({ where: { id: groupId, tenantId } }),
    ]);

    const instance = await prisma.instance.findFirst({ where: { tenantId, status: "CONNECTED" } });
    if (!instance) throw new AppError(409, "Nenhuma instância conectada para enviar o convite");

    const provider = getMessagingProvider(instance.provider);
    const result = await provider.sendGroupInvite({ instanceId: instance.id, to: contact.phone, inviteLink: group.inviteLink });

    if (result.status === "SENT") {
      await prisma.invite.create({ data: { contactId, groupId, event: "INVITE_SENT" } });
    }

    await writeLog({ tenantId, action: "GROUP_INVITE_SENT", resource: "group", resourceId: groupId, metadata: { contactId, status: result.status } });
  }
}

export const groupsService = new GroupsService();
