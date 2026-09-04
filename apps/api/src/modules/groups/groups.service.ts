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

    // Estatísticas do novo card compacto (seção 41): eligibleCount é o
    // mesmo valor para todo grupo deste tenant (é o "pool" de instâncias
    // que PODEM entrar agora - WHATSAPP_QR + CONNECTED), então só precisa
    // ser calculado uma vez. joinedCount é por grupo - quantas dessas
    // mesmas instâncias elegíveis já têm uma entrada bem-sucedida
    // (GroupJoin.status=JOINED) NESTE grupo especificamente. Tudo em lote
    // (2 queries no total, nunca uma por grupo) para não virar N+1 numa
    // conta com muitos grupos.
    //
    // inUseLeona (seção 48): número marcado como "em uso no Leona" fica de
    // fora do pool de elegíveis - o usuário pediu explicitamente que esses
    // números não fiquem disponíveis para entrar em grupos enquanto
    // estiverem marcados, já que estão sendo usados em outra ferramenta.
    const eligibleInstances = await prisma.instance.findMany({
      where: { tenantId, status: "CONNECTED", provider: "WHATSAPP_QR", inUseLeona: false },
      select: { id: true },
    });
    const eligibleIds = eligibleInstances.map((i) => i.id);
    const eligibleCount = eligibleIds.length;

    const joinedRows =
      eligibleIds.length > 0 && groups.length > 0
        ? await prisma.groupJoin.findMany({
            where: {
              tenantId,
              groupId: { in: groups.map((g) => g.id) },
              instanceId: { in: eligibleIds },
              status: "JOINED",
            },
            select: { groupId: true, instanceId: true },
            distinct: ["groupId", "instanceId"],
          })
        : [];

    const joinedByGroup = new Map<string, Set<string>>();
    for (const row of joinedRows) {
      if (!joinedByGroup.has(row.groupId)) joinedByGroup.set(row.groupId, new Set());
      joinedByGroup.get(row.groupId)!.add(row.instanceId);
    }

    // Marca cada grupo como global (catálogo do admin) ou privado deste
    // tenant, e traz o catálogo global pro topo da lista - Array.sort é
    // estável, então a ordem por data dentro de cada grupo é preservada.
    return groups
      .map((g) => {
        const joinedCount = joinedByGroup.get(g.id)?.size ?? 0;
        return {
          ...g,
          isGlobal: g.tenantId === null,
          stats: { eligibleCount, joinedCount, pendingCount: Math.max(0, eligibleCount - joinedCount) },
        };
      })
      .sort((a, b) => Number(b.isGlobal) - Number(a.isGlobal));
  }

  async create(tenantId: string, params: { name: string; description?: string; inviteLink: string; category?: string }) {
    return prisma.group.create({ data: { tenantId, ...params } });
  }

  /** Edita um grupo PRIVADO deste tenant (seção 41 - menu "⋯" > Editar
   * grupo). `findFirst({ id, tenantId })` já exclui naturalmente tanto
   * grupos de outros tenants quanto grupos do catálogo global (tenantId
   * nulo nunca bate com uma string real) - por isso o catálogo continua
   * editável só pelo admin, via adminUpdate. */
  async update(
    tenantId: string,
    id: string,
    params: { name?: string; description?: string; inviteLink?: string; category?: string }
  ) {
    const group = await prisma.group.findFirst({ where: { id, tenantId } });
    if (!group) throw new AppError(404, "Grupo não encontrado");
    return prisma.group.update({ where: { id }, data: params });
  }

  /** "Exclui" um grupo PRIVADO deste tenant - na prática oculta (isActive
   * false), igual ao padrão já usado no catálogo global, para preservar o
   * histórico de convites/entradas em vez de apagar tudo em cascata. */
  async remove(tenantId: string, id: string) {
    const group = await prisma.group.findFirst({ where: { id, tenantId } });
    if (!group) throw new AppError(404, "Grupo não encontrado");
    await prisma.group.update({ where: { id }, data: { isActive: false } });
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
   *
   * `instanceIds` (seção 41 - modal "Entrar no grupo"): quando informado,
   * restringe a entrada só a essas instâncias - mas o filtro
   * tenantId+CONNECTED+WHATSAPP_QR abaixo é sempre reaplicado no backend,
   * então uma instância que o front mostrou como elegível na hora da
   * seleção mas desconectou antes da confirmação (ou que nem pertence a
   * este tenant) nunca entra por engano só porque o ID veio no corpo da
   * requisição. Quando omitido/vazio, mantém o comportamento original:
   * entra com TODAS as instâncias elegíveis do tenant.
   *
   * inUseLeona (seção 48): mesma regra do eligibleCount em list() acima -
   * número marcado como "em uso no Leona" nunca entra em grupo por aqui,
   * mesmo que o ID tenha sido passado explicitamente em instanceIds.
   *
   * Já participa deste grupo (seção 49): uma instância que já tem uma
   * entrada JOINED NESTE grupo nunca entra de novo por aqui - mesmo que o ID
   * dela tenha sido passado explicitamente em instanceIds. Ela continua
   * podendo entrar normalmente em QUALQUER OUTRO grupo onde ainda não
   * esteja - o filtro é sempre por groupId, nunca global.
   */
  async joinAll(tenantId: string, groupId: string, instanceIds?: string[]) {
    const group = await prisma.group.findFirst({ where: { id: groupId, OR: [{ tenantId }, { tenantId: null }] } });
    if (!group) throw new AppError(404, "Grupo não encontrado");

    const inviteCode = extractInviteCode(group.inviteLink);
    if (!inviteCode) {
      throw new AppError(422, "Link de convite inválido - use o link oficial no formato https://chat.whatsapp.com/...");
    }

    const alreadyJoinedRows = await prisma.groupJoin.findMany({
      where: { tenantId, groupId, status: "JOINED" },
      select: { instanceId: true },
    });
    const alreadyJoinedIds = alreadyJoinedRows.map((r) => r.instanceId);

    const instances = await prisma.instance.findMany({
      where: {
        tenantId,
        status: "CONNECTED",
        provider: "WHATSAPP_QR",
        inUseLeona: false,
        id: {
          ...(instanceIds && instanceIds.length > 0 ? { in: instanceIds } : {}),
          notIn: alreadyJoinedIds,
        },
      },
    });
    if (instances.length === 0) {
      throw new AppError(409, "Nenhum número elegível encontrado para entrar no grupo");
    }

    const joins = [];
    for (let i = 0; i < instances.length; i++) {
      const groupJoin = await prisma.groupJoin.create({
        data: { tenantId, groupId, instanceId: instances[i].id, status: "QUEUED" },
      });
      // A primeira instância tenta quase imediatamente; cada uma depois
      // dela espera um pouco mais que a anterior (intervalo base crescente
      // + uma folga aleatória de até 30s), para as entradas não caírem
      // todas juntas mesmo em lotes com muitos números. Intervalo
      // "moderado" (pedido explícito do usuário - o intervalo anterior de
      // 60-180s por número estava deixando lotes grandes muito lentos):
      // ~15-45s entre um número e o próximo, ainda escalonado o
      // suficiente para não parecer um bot entrando em massa.
      const delayMs = i === 0 ? 0 : i * 15_000 + Math.floor(Math.random() * 30_000);
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
