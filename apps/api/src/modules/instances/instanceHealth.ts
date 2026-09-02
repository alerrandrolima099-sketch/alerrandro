import { prisma } from "../../lib/prisma";
import type { Instance, WarmupPair } from "@whatsapp-saas/database";

/**
 * Cálculo de saúde e aquecimento por número (seção 39 - Dashboard e Meus
 * Números profissional). Tudo aqui é derivado de dados reais já existentes
 * no banco - nenhum valor é inventado ou aleatório.
 *
 * Dados usados por métrica:
 * - Saúde (0-100): status atual da instância (`instances.status`) + número
 *   de desconexões nos últimos 7 dias (`logs`, action INSTANCE_DISCONNECTED)
 *   + volume de mensagens nos últimos 7 dias (`messages`) + engajamento no
 *   aquecimento (`warmup_pairs.enabled` / `warmup_pairs.lastError`).
 * - Nível de aquecimento (0-100%): tempo decorrido desde a criação do par
 *   de aquecimento (`warmup_pairs.createdAt`) combinado com o volume de
 *   mensagens de aquecimento trocadas nos últimos 7 dias
 *   (`warmup_messages`) comparado à meta diária do par
 *   (`warmup_pairs.dailyMessageTarget`).
 * - Grupos entrados: `group_joins` com status JOINED (seção "Entrar com
 *   todos os números").
 * - Mensagens recebidas: `messages` com direction INBOUND.
 * - Evolução (7d): mensagens INBOUND dos últimos 7 dias comparadas às dos
 *   7 dias anteriores. Sem dado suficiente (instância criada há menos de
 *   14 dias, ou sem mensagens no período anterior) mostra "insuficiente"
 *   em vez de uma porcentagem fabricada.
 *
 * Nenhum campo novo foi necessário no banco para estas métricas - são
 * 100% calculadas em tempo real a partir de tabelas que já existem.
 */

export const WARMUP_MATURITY_DAYS = 30;

export type HealthTier = "GOOD" | "ATTENTION" | "CRITICAL";

export type HealthBreakdown = {
  score: number;
  tier: HealthTier;
  tierLabel: string;
  color: "green" | "yellow" | "red";
};

export function healthTierFromScore(score: number): HealthBreakdown {
  if (score >= 75) return { score, tier: "GOOD", tierLabel: "Boa saúde", color: "green" };
  if (score >= 50) return { score, tier: "ATTENTION", tierLabel: "Atenção", color: "yellow" };
  return { score, tier: "CRITICAL", tierLabel: "Crítica", color: "red" };
}

export function computeHealthScore(params: {
  status: string;
  disconnects7d: number;
  messages7d: number;
  pair: Pick<WarmupPair, "enabled" | "lastError"> | null;
}): number {
  let score = 0;

  switch (params.status) {
    case "CONNECTED":
      score += 40;
      break;
    case "CONNECTING":
      score += 20;
      break;
    case "PAUSED":
      score += 25;
      break;
    case "DISCONNECTED":
      score += 5;
      break;
    default:
      // ERROR
      score += 0;
  }

  if (params.disconnects7d === 0) score += 25;
  else if (params.disconnects7d === 1) score += 18;
  else if (params.disconnects7d <= 3) score += 10;

  if (params.messages7d >= 100) score += 20;
  else if (params.messages7d >= 30) score += 15;
  else if (params.messages7d >= 10) score += 10;
  else if (params.messages7d >= 1) score += 5;

  if (!params.pair) score += 8;
  else if (!params.pair.enabled) score += 4;
  else if (params.pair.lastError) score += 6;
  else score += 15;

  return Math.max(0, Math.min(100, score));
}

export type WarmupTier = "STARTING" | "WARMING" | "WARM" | "VERY_WARM";

export function warmupTierFromLevel(level: number): {
  tier: WarmupTier;
  label: string;
  color: "blue" | "orange" | "yellow" | "green";
} {
  if (level <= 30) return { tier: "STARTING", label: "Iniciando", color: "blue" };
  if (level <= 60) return { tier: "WARMING", label: "Em aquecimento", color: "orange" };
  if (level <= 80) return { tier: "WARM", label: "Aquecido", color: "yellow" };
  return { tier: "VERY_WARM", label: "Muito aquecido", color: "green" };
}

export function computeWarmupLevel(
  pair: Pick<WarmupPair, "enabled" | "createdAt" | "dailyMessageTarget"> | null,
  recentWarmupMessages: number
): { level: number; daysWarming: number } {
  if (!pair) return { level: 0, daysWarming: 0 };
  const daysWarming = Math.max(0, Math.floor((Date.now() - pair.createdAt.getTime()) / (24 * 60 * 60 * 1000)));
  const timeFactor = Math.min(1, daysWarming / WARMUP_MATURITY_DAYS);
  const expected = Math.max(pair.dailyMessageTarget, 1) * 7;
  const activityFactor = pair.enabled ? Math.min(1, recentWarmupMessages / expected) : 0;
  const level = Math.round(timeFactor * 70 + activityFactor * 30);
  return { level: Math.max(0, Math.min(100, level)), daysWarming };
}

/** Par de aquecimento (se houver) ao qual a instância pertence - o modelo
 * WarmupPair é escopado por par, não por instância isolada. */
export function findPairForInstance(instanceId: string, pairs: WarmupPair[]): WarmupPair | null {
  return pairs.find((p) => p.instanceAId === instanceId || p.instanceBId === instanceId) ?? null;
}

const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_14D_MS = 14 * 24 * 60 * 60 * 1000;
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_2H_MS = 2 * 60 * 60 * 1000;

type CountRow = { instanceId?: string; resourceId?: string | null; warmupPairId?: string; _count: { _all: number } };

function toCountMap(rows: CountRow[], key: "instanceId" | "resourceId" | "warmupPairId"): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r[key];
    if (k) map.set(k, r._count._all);
  }
  return map;
}

/** Busca, em lote (sem N+1), todos os sinais reais usados para calcular
 * saúde/aquecimento/estatísticas de um conjunto de instâncias. */
async function getInstanceSignals(tenantId: string, ids: string[]) {
  const since7d = new Date(Date.now() - WINDOW_7D_MS);
  const since14d = new Date(Date.now() - WINDOW_14D_MS);

  const [disconnectLogs7d, msgCounts7d, pairs, groupJoinsJoined, msgReceivedTotal, msgReceived7d, msgReceivedPrev7d] = await Promise.all([
    prisma.log.groupBy({
      by: ["resourceId"],
      where: { tenantId, resource: "instance", action: "INSTANCE_DISCONNECTED", resourceId: { in: ids }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.warmupPair.findMany({ where: { tenantId } }),
    prisma.groupJoin.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, status: "JOINED" },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, direction: "INBOUND" },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, direction: "INBOUND", createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, direction: "INBOUND", createdAt: { gte: since14d, lt: since7d } },
      _count: { _all: true },
    }),
  ]);

  const pairIds = pairs.map((p: WarmupPair) => p.id);
  const warmupMsgCounts7d = pairIds.length
    ? await prisma.warmupMessage.groupBy({
        by: ["warmupPairId"],
        where: { warmupPairId: { in: pairIds }, createdAt: { gte: since7d } },
        _count: { _all: true },
      })
    : [];

  return {
    disconnectMap: toCountMap(disconnectLogs7d as CountRow[], "resourceId"),
    msgMap7d: toCountMap(msgCounts7d as CountRow[], "instanceId"),
    pairs,
    groupsJoinedMap: toCountMap(groupJoinsJoined as CountRow[], "instanceId"),
    msgReceivedTotalMap: toCountMap(msgReceivedTotal as CountRow[], "instanceId"),
    msgReceived7dMap: toCountMap(msgReceived7d as CountRow[], "instanceId"),
    msgReceivedPrev7dMap: toCountMap(msgReceivedPrev7d as CountRow[], "instanceId"),
    warmupMsg7dMap: toCountMap(warmupMsgCounts7d as CountRow[], "warmupPairId"),
  };
}

export type WarmupStatus = "NONE" | "ACTIVE" | "PAUSED" | "ISSUE";

export type Evolution7d = { status: "ok"; pct: number; direction: "up" | "down" | "flat" } | { status: "insufficient" };

export type InstanceStatsFields = {
  healthScore: number;
  healthTier: HealthTier;
  healthTierLabel: string;
  healthColor: "green" | "yellow" | "red";
  warmupLevel: number;
  warmupTier: WarmupTier;
  warmupTierLabel: string;
  warmupColor: "blue" | "orange" | "yellow" | "green";
  daysWarming: number;
  warmupStatus: WarmupStatus;
  groupsJoined: number;
  messagesReceived: number;
  evolution7d: Evolution7d;
  active: boolean;
};

/**
 * Enriquece uma lista de instâncias (já carregadas do banco) com todas as
 * métricas calculadas - usado tanto pela listagem de "Meus Números" quanto
 * pelo detalhe de uma instância e pelos alertas do Dashboard. Uma única
 * rodada de consultas em lote para todas as instâncias, sem N+1.
 */
export async function attachInstanceStats<T extends Instance>(
  tenantId: string,
  instances: T[]
): Promise<(T & InstanceStatsFields)[]> {
  if (instances.length === 0) return [];
  const ids = instances.map((i) => i.id);
  const signals = await getInstanceSignals(tenantId, ids);
  const minAgeForEvolutionMs = WINDOW_14D_MS;

  return instances.map((inst) => {
    const pair = findPairForInstance(inst.id, signals.pairs);
    const disconnects7d = signals.disconnectMap.get(inst.id) ?? 0;
    const messages7d = signals.msgMap7d.get(inst.id) ?? 0;
    const healthScore = computeHealthScore({ status: inst.status, disconnects7d, messages7d, pair });
    const health = healthTierFromScore(healthScore);

    const recentWarmupMessages = pair ? signals.warmupMsg7dMap.get(pair.id) ?? 0 : 0;
    const { level: warmupLevel, daysWarming } = computeWarmupLevel(pair, recentWarmupMessages);
    const warmupTierInfo = warmupTierFromLevel(warmupLevel);

    let warmupStatus: WarmupStatus = "NONE";
    if (pair) {
      if (!pair.enabled) warmupStatus = "PAUSED";
      else if (pair.lastError) warmupStatus = "ISSUE";
      else warmupStatus = "ACTIVE";
    }

    const groupsJoined = signals.groupsJoinedMap.get(inst.id) ?? 0;
    const messagesReceived = signals.msgReceivedTotalMap.get(inst.id) ?? 0;

    const current7d = signals.msgReceived7dMap.get(inst.id) ?? 0;
    const prev7d = signals.msgReceivedPrev7dMap.get(inst.id) ?? 0;
    const ageMs = Date.now() - inst.createdAt.getTime();

    let evolution7d: Evolution7d;
    if (ageMs < minAgeForEvolutionMs || prev7d === 0) {
      evolution7d = { status: "insufficient" };
    } else {
      const pct = Math.round(((current7d - prev7d) / prev7d) * 100);
      evolution7d = { status: "ok", pct, direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
    }

    return {
      ...inst,
      healthScore,
      healthTier: health.tier,
      healthTierLabel: health.tierLabel,
      healthColor: health.color,
      warmupLevel,
      warmupTier: warmupTierInfo.tier,
      warmupTierLabel: warmupTierInfo.label,
      warmupColor: warmupTierInfo.color,
      daysWarming,
      warmupStatus,
      groupsJoined,
      messagesReceived,
      evolution7d,
      active: inst.status === "CONNECTED",
    };
  });
}

export type DashboardAlert = {
  id: string;
  severity: "critical" | "warning" | "success";
  title: string;
  message: string;
  instanceId: string;
  createdAt: string;
};

/**
 * Alertas do Dashboard - todos derivados de eventos reais:
 * - crítico: instância desconectada ou com erro agora.
 * - atenção: saúde calculada abaixo de 75/100 (desconexões recentes,
 *   pouca atividade ou aquecimento com erro).
 * - sucesso: instância reconectou nas últimas 2h após ter desconectado
 *   nas últimas 24h.
 */
export async function getDashboardAlerts(tenantId: string): Promise<DashboardAlert[]> {
  const instances = await prisma.instance.findMany({ where: { tenantId } });
  if (instances.length === 0) return [];

  const ids = instances.map((i: Instance) => i.id);
  const since24h = new Date(Date.now() - WINDOW_24H_MS);
  const since2h = new Date(Date.now() - WINDOW_2H_MS);

  const [statsList, recentDisconnectLogs] = await Promise.all([
    attachInstanceStats(tenantId, instances),
    prisma.log.findMany({
      where: { tenantId, resource: "instance", action: "INSTANCE_DISCONNECTED", resourceId: { in: ids }, createdAt: { gte: since24h } },
      select: { resourceId: true },
      distinct: ["resourceId"],
    }),
  ]);

  const recentDisconnectSet = new Set<string>(
    recentDisconnectLogs.map((r: { resourceId: string | null }) => r.resourceId as string)
  );

  const alerts: DashboardAlert[] = [];

  for (const inst of statsList) {
    if (inst.status === "DISCONNECTED" || inst.status === "ERROR") {
      alerts.push({
        id: `conn-${inst.id}`,
        severity: "critical",
        title: "Conexão perdida",
        message: inst.status === "ERROR" ? `${inst.name} está com erro de conexão.` : `${inst.name} está desconectado.`,
        instanceId: inst.id,
        createdAt: (inst.lastActivityAt ?? inst.updatedAt).toISOString(),
      });
    } else if (inst.healthScore < 75) {
      alerts.push({
        id: `health-${inst.id}`,
        severity: "warning",
        title: "Número precisa de atenção",
        message: `${inst.name} apresenta atividade abaixo do esperado (saúde ${inst.healthScore}/100).`,
        instanceId: inst.id,
        createdAt: inst.updatedAt.toISOString(),
      });
    } else if (
      inst.status === "CONNECTED" &&
      recentDisconnectSet.has(inst.id) &&
      inst.lastActivityAt &&
      inst.lastActivityAt >= since2h
    ) {
      alerts.push({
        id: `reconnect-${inst.id}`,
        severity: "success",
        title: "Número conectado",
        message: `${inst.name} voltou a ficar online.`,
        instanceId: inst.id,
        createdAt: inst.lastActivityAt.toISOString(),
      });
    }
  }

  alerts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return alerts.slice(0, 12);
}
