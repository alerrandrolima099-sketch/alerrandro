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
 *
 * Catálogo global (seção 40): um grupo com tenantId nulo foi criado pelo
 * admin em /admin/grupos e fica disponível para TODOS os tenants - eles
 * podem oferecer convite, ver e usar "Entrar com todos os números" nele
 * normalmente, só não podem editar/excluir (isso é exclusivo do admin, ver
 * adminUpdate abaixo). Os grupos privados que cada tenant cria por conta
 * própria (tenantId preenchido) continuam funcionando exatamente como
 * antes, visíveis só para quem criou.
 */
export class GroupsService {
  async list(tenantId: string) {
    const groups = await prisma.group.findMany({
      where: { isActive: true, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { createdAt: "desc" },
    });

    // Marca cada grupo como global (catálogo do admin) ou privado deste
    // tenant, e traz o catálogo global pro topo da lista - Array.sort é
    // estável, então a ordem por data dentro de cada grupo é preservada.
    return groups
      .map((g) => ({ ...g, isGlobal: g.tenantId === null }))
      .sort((a, b) => Number(b.isGlobal) - Number(a.isGlobal));
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
      // O grupo pode ser privado deste tenant OU global (catálogo do admin) -
      // em ambos os casos o tenant pode oferecer/enviar o convite.
      prisma.group.findFirstOrThrow({ where: { id: groupId, OR: [{ tenantId }, { tenantId: null }] } }),
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
   * Funciona tanto para grupos privados do tenant quanto para grupos do
   * catálogo global (seção 40).
   */
  async joinAll(tenantId: string, groupId: string) {
    const group = await prisma.group.findFirst({ where: { id: groupId, OR: [{ tenantId }, { tenantId: null }] } });
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

  /** Histórico de tentativas de entrada num grupo, mais recentes primeiro.
   * Sempre restrito ao próprio tenant - mesmo num grupo global, cada tenant
   * só vê as tentativas feitas com os SEUS próprios números. */
  async listJoins(tenantId: string, groupId: string) {
    return prisma.groupJoin.findMany({
      where: { tenantId, groupId },
      orderBy: { createdAt: "desc" },
      include: { instance: { select: { id: true, name: true, phoneNumber: true } } },
    });
  }

  // -------------------------------------------------------------------
  // Catálogo global (seção 40) - usado só pelas rotas /admin/groups,
  // guardadas por requireRole("ADMIN"). Um grupo criado aqui tem
  // tenantId nulo e passa a aparecer para todos os tenants em list()
  // acima. Os grupos privados que cada tenant cria em POST /groups
  // (create() acima) nunca aparecem/são editáveis por aqui.
  // -------------------------------------------------------------------

  async adminList() {
    return prisma.group.findMany({ where: { tenantId: null }, orderBy: { createdAt: "desc" } });
  }

  async adminCreate(params: { name: string; description?: string; inviteLink: string; category?: string }) {
    return prisma.group.create({ data: { tenantId: null, ...params } });
  }

  async adminUpdate(
    id: string,
    params: { name?: string; description?: string; inviteLink?: string; category?: string; isActive?: boolean }
  ) {
    const group = await prisma.group.findFirst({ where: { id, tenantId: null } });
    if (!group) throw new AppError(404, "Grupo do catálogo não encontrado");
    return prisma.group.update({ where: { id }, data: params });
  }
}

export const groupsService = new GroupsService();
