"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Trash2, Play, Pause, History, Gauge, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";

type InstanceLite = {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
};

type WarmupPair = {
  id: string;
  instanceA: InstanceLite;
  instanceB: InstanceLite;
  enabled: boolean;
  dailyMessageTarget: number;
  sentToday: number;
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  lastError: string | null;
  createdAt: string;
};

type WarmupMessage = {
  id: string;
  senderInstanceId: string;
  content: string;
  createdAt: string;
};

// Presets de intensidade (seção 38) - só traduzem o preset escolhido nos 3
// campos que a API já aceita hoje (dailyMessageTarget/minIntervalMinutes/
// maxIntervalMinutes). Não existe campo de "estratégia" salvo no banco, então
// depois de criado o par a gente não sabe mais qual preset foi usado -
// isso é uma limitação real, não escondida: ao editar um par existente o
// usuário ajusta os números diretamente.
const INTENSITY_PRESETS = [
  {
    key: "conservador",
    label: "Conservador",
    description: "Ritmo mais lento, menor volume - indicado pra números novos ou já com histórico de bloqueio.",
    dailyMessageTarget: 10,
    minIntervalMinutes: 40,
    maxIntervalMinutes: 120,
  },
  {
    key: "moderado",
    label: "Moderado",
    description: "Equilíbrio entre ritmo e segurança - bom ponto de partida na maioria dos casos.",
    dailyMessageTarget: 20,
    minIntervalMinutes: 20,
    maxIntervalMinutes: 90,
  },
  {
    key: "agressivo",
    label: "Agressivo",
    description: "Ritmo mais rápido - acompanhe de perto e reduza se aparecerem erros de envio.",
    dailyMessageTarget: 40,
    minIntervalMinutes: 10,
    maxIntervalMinutes: 45,
  },
] as const;

function daysSince(iso: string) {
  const created = new Date(iso).getTime();
  const diff = Date.now() - created;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export default function WarmupPage() {
  const [instances, setInstances] = useState<InstanceLite[]>([]);
  const [pairs, setPairs] = useState<WarmupPair[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [instanceAId, setInstanceAId] = useState("");
  const [instanceBId, setInstanceBId] = useState("");
  const [preset, setPreset] = useState<(typeof INTENSITY_PRESETS)[number]["key"] | null>("moderado");
  const [dailyMessageTarget, setDailyMessageTarget] = useState(20);
  const [minIntervalMinutes, setMinIntervalMinutes] = useState(20);
  const [maxIntervalMinutes, setMaxIntervalMinutes] = useState(90);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<WarmupMessage[]>([]);

  async function load() {
    const [instancesData, pairsData] = await Promise.all([
      api<InstanceLite[]>("/instances"),
      api<WarmupPair[]>("/warmup-pairs"),
    ]);
    setInstances(instancesData);
    setPairs(pairsData);
  }

  useEffect(() => {
    load();
  }, []);

  function applyPreset(key: (typeof INTENSITY_PRESETS)[number]["key"]) {
    const found = INTENSITY_PRESETS.find((p) => p.key === key);
    if (!found) return;
    setPreset(key);
    setDailyMessageTarget(found.dailyMessageTarget);
    setMinIntervalMinutes(found.minIntervalMinutes);
    setMaxIntervalMinutes(found.maxIntervalMinutes);
  }

  async function createPair(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceAId || !instanceBId) return;
    await api("/warmup-pairs", {
      method: "POST",
      body: { instanceAId, instanceBId, dailyMessageTarget, minIntervalMinutes, maxIntervalMinutes },
    });
    setInstanceAId("");
    setInstanceBId("");
    applyPreset("moderado");
    setShowCreate(false);
    await load();
  }

  async function toggle(pair: WarmupPair) {
    setBusy(pair.id);
    try {
      await api(`/warmup-pairs/${pair.id}`, { method: "PATCH", body: { enabled: !pair.enabled } });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este par de aquecimento?")) return;
    await api(`/warmup-pairs/${id}`, { method: "DELETE" });
    await load();
  }

  async function toggleHistory(id: string) {
    if (historyOpenId === id) {
      setHistoryOpenId(null);
      return;
    }
    const data = await api<WarmupMessage[]>(`/warmup-pairs/${id}/messages`);
    setHistory(data);
    setHistoryOpenId(id);
  }

  const stats = useMemo(() => {
    const active = pairs.filter((p) => p.enabled).length;
    const sentToday = pairs.reduce((sum, p) => sum + p.sentToday, 0);
    const targetToday = pairs.reduce((sum, p) => sum + p.dailyMessageTarget, 0);
    const avgPct = targetToday > 0 ? Math.round((sentToday / targetToday) * 100) : 0;
    return { active, paused: pairs.length - active, sentToday, avgPct };
  }, [pairs]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Central de Aquecimento</h1>
          <p className="text-muted max-w-2xl">
            Duas das suas instâncias trocam mensagens automaticamente entre si, geradas por IA, num ritmo espaçado
            (minutos a horas) - simula atividade real de conversa, o que ajuda a reduzir o risco de bloqueio antes
            de usar o número em campanhas de verdade.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm whitespace-nowrap"
        >
          <Flame size={16} /> Novo par
        </button>
      </div>

      <p className="text-xs text-yellow-400 mb-6">
        Aquecer não elimina o risco de bloqueio de números conectados via QR Code (não oficial) - só ajuda a
        reduzir. Use instâncias já conectadas, evite metas diárias muito altas e respeite os Termos de Uso do
        WhatsApp.
      </p>

      {pairs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Pares aquecendo" value={stats.active} icon={Flame} accent="bg-primary/15 text-primary" />
          <StatCard label="Pares pausados" value={stats.paused} icon={Pause} accent="bg-gray-500/15 text-gray-400" />
          <StatCard label="Mensagens hoje" value={stats.sentToday} icon={TrendingUp} />
          <StatCard label="Meta média atingida" value={`${stats.avgPct}%`} icon={Gauge} accent="bg-accent/15 text-accent" />
        </div>
      )}

      {showCreate && (
        <form onSubmit={createPair} className="bg-surface border border-border rounded-xl p-4 mb-6 space-y-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted block mb-1.5">Instância A</label>
              <select
                value={instanceAId}
                onChange={(e) => setInstanceAId(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione...</option>
                {instances.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.id === instanceBId}>
                    {i.name} {i.status !== "CONNECTED" ? "(não conectada)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm text-muted block mb-1.5">Instância B</label>
              <select
                value={instanceBId}
                onChange={(e) => setInstanceBId(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione...</option>
                {instances.map((i) => (
                  <option key={i.id} value={i.id} disabled={i.id === instanceAId}>
                    {i.name} {i.status !== "CONNECTED" ? "(não conectada)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted block mb-1.5">Intensidade</label>
            <div className="grid sm:grid-cols-3 gap-2">
              {INTENSITY_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  className={
                    "text-left rounded-lg border px-3 py-2.5 transition-colors " +
                    (preset === p.key
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background/60 hover:border-borderLight")
                  }
                >
                  <p className={"text-sm font-medium " + (preset === p.key ? "text-primary" : "")}>{p.label}</p>
                  <p className="text-xs text-muted mt-0.5">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-36">
              <label className="text-sm text-muted block mb-1.5">Mensagens/dia</label>
              <input
                type="number"
                min={1}
                max={200}
                value={dailyMessageTarget}
                onChange={(e) => {
                  setPreset(null);
                  setDailyMessageTarget(Number(e.target.value));
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="w-36">
              <label className="text-sm text-muted block mb-1.5">Intervalo mín. (min)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={minIntervalMinutes}
                onChange={(e) => {
                  setPreset(null);
                  setMinIntervalMinutes(Number(e.target.value));
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="w-36">
              <label className="text-sm text-muted block mb-1.5">Intervalo máx. (min)</label>
              <input
                type="number"
                min={1}
                max={1440}
                value={maxIntervalMinutes}
                onChange={(e) => {
                  setPreset(null);
                  setMaxIntervalMinutes(Number(e.target.value));
                }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Criar</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {pairs.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="Nenhum par de aquecimento cadastrado"
          description="Escolha duas instâncias conectadas e uma intensidade para começar a esquentar seus números."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium mx-auto"
            >
              <Flame size={16} /> Novo par
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pairs.map((pair) => {
            const pct = Math.min(100, Math.round((pair.sentToday / Math.max(pair.dailyMessageTarget, 1)) * 100));
            return (
              <div key={pair.id} className="bg-surface border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="font-medium truncate">
                    {pair.instanceA.name} <span className="text-muted">⇄</span> {pair.instanceB.name}
                  </h3>
                  <Badge status={pair.enabled ? "ACTIVE" : "PAUSED"} />
                </div>

                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted">
                    Hoje: {pair.sentToday} / {pair.dailyMessageTarget} mensagens
                  </span>
                  <span className="text-xs text-muted">{pct}%</span>
                </div>
                <div className="h-1.5 bg-background rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <p className="text-xs text-muted mb-1">
                  Intervalo entre mensagens: {pair.minIntervalMinutes}-{pair.maxIntervalMinutes} min · criado há{" "}
                  {daysSince(pair.createdAt)} dia(s)
                </p>
                {pair.lastError && <p className="text-sm text-red-400 mb-1">Erro: {pair.lastError}</p>}

                {historyOpenId === pair.id && (
                  <div className="my-3 bg-background border border-border rounded-lg p-3 max-h-56 overflow-y-auto space-y-2">
                    {history.length === 0 && <p className="text-xs text-muted">Nenhuma mensagem trocada ainda.</p>}
                    {history
                      .slice()
                      .reverse()
                      .map((m) => {
                        const fromA = m.senderInstanceId === pair.instanceA.id;
                        return (
                          <div key={m.id} className={fromA ? "text-left" : "text-right"}>
                            <span
                              className={
                                "inline-block px-2.5 py-1.5 rounded-lg text-xs max-w-[85%] " +
                                (fromA ? "bg-primary/15 text-primary" : "bg-gray-500/15 text-gray-300")
                              }
                            >
                              {m.content}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}

                <div className="flex gap-2 mt-4 flex-wrap">
                  <button
                    disabled={busy === pair.id}
                    onClick={() => toggle(pair)}
                    className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    {pair.enabled ? <Pause size={14} /> : <Play size={14} />}
                    {pair.enabled ? "Pausar" : "Retomar"}
                  </button>
                  <button
                    onClick={() => toggleHistory(pair.id)}
                    className="flex items-center gap-1.5 text-xs bg-gray-500/15 text-gray-300 rounded-lg px-3 py-1.5"
                  >
                    <History size={14} /> {historyOpenId === pair.id ? "Ocultar" : "Histórico"}
                  </button>
                  <button
                    onClick={() => remove(pair.id)}
                    className="flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
