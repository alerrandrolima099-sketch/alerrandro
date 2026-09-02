import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { getMessagingProvider, enqueueGroupJoin } from "../../messaging";
import { writeLog } from "../../lib/logger";

/**
 * Extrai o código do convite de um link oficial do WhatsApp
 * (https://chat.whatsapp.com/<code>) - é esse código que o Baileys usa em
 * sock.groupAcceptInvite(). Retorna null se o link não tiver o formato
 * esperado, para o chamador poder recusar com uma mensagem clara em vez de
 * mandar um código vazio/inválido para o WhatsApp.
 */
function extractInviteCode(inviteLink: string): string | null {
  try {
    const url = new URL(inviteLink);
    if (!url.hostname.includes("chat.whatsapp.com")) return null;
    const code = url.pathname.replace(/^\/+/, "").trim();
    return code || null;
  } catch {
    return null;
  }
}

/**
 * Grupos/comunidades (seção 15). Fluxo obrigatório:
 * atendimento concluído -> verificar consentimento -> oferecer comunidade ->
 * contato aceita -> enviar convite oficial -> registrar evento.
 * NUNCA adiciona contatos automaticamente a um grupo.
 *
 * "Entrar com todos os números" (seção 38) é diferente: não envolve contato
 * nenhum, é o próprio tenant mandando suas instâncias entrarem no grupo.
 * Só funciona para instâncias WHATSAPP_QR (ver joinGroup em cada provider) -
 * e as entradas são escalonadas com um delay aleatório crescente entre uma
 * instância e outra, para reduzir o risco de o WhatsApp identificar um
 * padrão de bot (vários números entrando no mesmo grupo ao mesmo tempo).
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

  /**
   * Faz todas as instâncias WHATSAPP_QR conectadas do tenant entrarem no
   * grupo, cada uma com um pequeno intervalo aleatório em relação à
   * anterior. Cria uma linha GroupJoin por instância (status QUEUED) e
   * devolve a lista - o front-end usa isso pra abrir o painel de progresso
   * e faz polling em listJoins() até todas saírem de QUEUED/JOINING.
   */
  async joinAll(tenantId: string, groupId: string) {
    const group = await prisma.group.findFirst({ where: { id: groupId, tenantId } });
    if (!group) throw new AppError(404, "Grupo não encontrado");

    const inviteCode = extractInviteCode(group.inviteLink);
    if (!inviteCode) {
      throw new AppError(422, "Link de convite inválido - use o link oficial no formato https://chat.whatsapp.com/...");
    }

    const instances = await prisma.instance.findMany({
      where: { tenantId, status: "CONNECTED", provider: "WHATSAPP_QR" },
    });
    if (instances.length === 0) {
      throw new AppError(409, "Nenhum número conectado via QR Code encontrado para entrar no grupo");
    }

    const joins = [];
    for (let i = 0; i < instances.length; i++) {
      const groupJoin = await prisma.groupJoin.create({
        data: { tenantId, groupId, instanceId: instances[i].id, status: "QUEUED" },
      });
      // A primeira instância tenta quase imediatamente; cada uma depois
      // dela espera um pouco mais que a anterior (intervalo base crescente
      // + uma folga aleatória de até 2min), para as entradas não caírem
      // todas juntas mesmo em lotes com muitos números.
      const delayMs = i === 0 ? 0 : i * 60_000 + Math.floor(Math.random() * 120_000);
      await enqueueGroupJoin({ groupJoinId: groupJoin.id }, delayMs);
      joins.push(groupJoin);
    }

    await writeLog({
      tenantId,
      action: "GROUP_JOIN_ALL_STARTED",
      resource: "group",
      resourceId: groupId,
      metadata: { instanceCount: instances.length },
    });

    return joins;
  }

  /** Histórico de tentativas de entrada num grupo, mais recentes primeiro. */
  async listJoins(tenantId: string, groupId: string) {
    return prisma.groupJoin.findMany({
      where: { tenantId, groupId },
      orderBy: { createdAt: "desc" },
      include: { instance: { select: { id: true, name: true, phoneNumber: true } } },
    });
  }
}

export const groupsService = new GroupsService();
