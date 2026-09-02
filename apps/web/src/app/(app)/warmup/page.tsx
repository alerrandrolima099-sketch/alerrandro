"use client";

import { useEffect, useState } from "react";
import { Flame, Trash2, Play, Pause, History } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

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

export default function WarmupPage() {
  const [instances, setInstances] = useState<InstanceLite[]>([]);
  const [pairs, setPairs] = useState<WarmupPair[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [instanceAId, setInstanceAId] = useState("");
  const [instanceBId, setInstanceBId] = useState("");
  const [dailyMessageTarget, setDailyMessageTarget] = useState(20);
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

  async function createPair(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceAId || !instanceBId) return;
    await api("/warmup-pairs", {
      method: "POST",
      body: { instanceAId, instanceBId, dailyMessageTarget },
    });
    setInstanceAId("");
    setInstanceBId("");
    setDailyMessageTarget(20);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Aquecimento de números</h1>
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
        reduzir. Use instâncias já conectadas e evite metas diárias muito altas.
      </p>

      {showCreate && (
        <form onSubmit={createPair} className="bg-surface border border-border rounded-xl p-4 mb-6 flex gap-3 items-end flex-wrap">
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
          <div className="w-40">
            <label className="text-sm text-muted block mb-1.5">Mensagens/dia</label>
            <input
              type="number"
              min={1}
              max={200}
              value={dailyMessageTarget}
              onChange={(e) => setDailyMessageTarget(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Criar</button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
            Cancelar
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {pairs.map((pair) => (
          <div key={pair.id} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">
                {pair.instanceA.name} <span className="text-muted">⇄</span> {pair.instanceB.name}
              </h3>
              <Badge status={pair.enabled ? "ACTIVE" : "PAUSED"} />
            </div>
            <p className="text-sm text-muted mb-1">
              Hoje: {pair.sentToday} / {pair.dailyMessageTarget} mensagens
            </p>
            <p className="text-xs text-muted mb-1">
              Intervalo entre mensagens: {pair.minIntervalMinutes}-{pair.maxIntervalMinutes} min
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

            <div className="flex gap-2 mt-4">
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
        ))}

        {pairs.length === 0 && (
          <p className="text-muted text-sm col-span-full">
            Nenhum par de aquecimento cadastrado ainda. Clique em "Novo par" para começar.
          </p>
        )}
      </div>
    </div>
  );
}
