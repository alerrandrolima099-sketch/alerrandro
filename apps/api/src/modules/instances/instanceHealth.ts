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
 *
 * Nenhum campo novo foi necessário no banco para estas duas métricas - são
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

export type DashboardAlert = {
  id: string;
  severity: "critical" | "warning" | "success";
  title: string;
  message: string;
  instanceId: string;
  createdAt: string;
};

const WINDOW_7D_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_24H_MS = 24 * 60 * 60 * 1000;
const WINDOW_2H_MS = 2 * 60 * 60 * 1000;

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
  const since7d = new Date(Date.now() - WINDOW_7D_MS);
  const since24h = new Date(Date.now() - WINDOW_24H_MS);
  const since2h = new Date(Date.now() - WINDOW_2H_MS);

  const [disconnectLogs7d, recentDisconnectLogs, msgCounts7d, pairs] = await Promise.all([
    prisma.log.groupBy({
      by: ["resourceId"],
      where: { tenantId, resource: "instance", action: "INSTANCE_DISCONNECTED", resourceId: { in: ids }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.log.findMany({
      where: { tenantId, resource: "instance", action: "INSTANCE_DISCONNECTED", resourceId: { in: ids }, createdAt: { gte: since24h } },
      select: { resourceId: true },
      distinct: ["resourceId"],
    }),
    prisma.message.groupBy({
      by: ["instanceId"],
      where: { instanceId: { in: ids }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }),
    prisma.warmupPair.findMany({ where: { tenantId } }),
  ]);

  const disconnectMap = new Map<string, number>(
    disconnectLogs7d.map((r: { resourceId: string | null; _count: { _all: number } }) => [r.resourceId as string, r._count._all])
  );
  const recentDisconnectSet = new Set<string>(
    recentDisconnectLogs.map((r: { resourceId: string | null }) => r.resourceId as string)
  );
  const msgMap = new Map<string, number>(
    msgCounts7d.map((r: { instanceId: string; _count: { _all: number } }) => [r.instanceId, r._count._all])
  );

  const alerts: DashboardAlert[] = [];

  for (const inst of instances) {
    const pair = findPairForInstance(inst.id, pairs);
    const disconnects7d = disconnectMap.get(inst.id) ?? 0;
    const messages7d = msgMap.get(inst.id) ?? 0;
    const score = computeHealthScore({ status: inst.status, disconnects7d, messages7d, pair });

    if (inst.status === "DISCONNECTED" || inst.status === "ERROR") {
      alerts.push({
        id: `conn-${inst.id}`,
        severity: "critical",
        title: "Conexão perdida",
        message: inst.status === "ERROR" ? `${inst.name} está com erro de conexão.` : `${inst.name} está desconectado.`,
        instanceId: inst.id,
        createdAt: (inst.lastActivityAt ?? inst.updatedAt).toISOString(),
      });
    } else if (score < 75) {
      alerts.push({
        id: `health-${inst.id}`,
        severity: "warning",
        title: "Número precisa de atenção",
        message: `${inst.name} apresenta atividade abaixo do esperado (saúde ${score}/100).`,
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
