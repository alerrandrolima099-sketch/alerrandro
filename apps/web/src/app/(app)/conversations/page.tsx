"use client";

import { useEffect, useRef, useState } from "react";
import { Radio, Flame } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

// Conversas (seção 38): monitor das trocas de mensagem de aquecimento entre
// os números do tenant - NÃO é uma caixa de entrada de clientes (isso é a
// página Atendimentos, com o código que já existia aqui antes). Reaproveita
// os mesmos endpoints que a Central de Aquecimento já usa
// (/warmup-pairs e /warmup-pairs/:id/messages) - nenhum dado novo, só uma
// forma melhor de visualizar o que já existia escondido num accordion.

type InstanceLite = { id: string; name: string };

type WarmupPair = {
  id: string;
  instanceA: InstanceLite;
  instanceB: InstanceLite;
  enabled: boolean;
  dailyMessageTarget: number;
  sentToday: number;
};

type WarmupMessage = {
  id: string;
  senderInstanceId: string;
  content: string;
  createdAt: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-pink-400 to-rose-500",
  "from-lime-400 to-green-500",
];

function avatarGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(name)} text-white font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

// O worker de aquecimento roda em ciclos de minutos (não é atendimento em
// tempo real), então um polling leve já reflete o que está acontecendo sem
// precisar de WebSocket aqui.
const POLL_MS = 30_000;

export default function ConversationsPage() {
  const [pairs, setPairs] = useState<WarmupPair[]>([]);
  const [selected, setSelected] = useState<WarmupPair | null>(null);
  const [messages, setMessages] = useState<WarmupMessage[]>([]);
  const selectedRef = useRef<WarmupPair | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  async function load() {
    setPairs(await api<WarmupPair[]>("/warmup-pairs"));
  }

  async function loadMessages(pairId: string) {
    setMessages(await api<WarmupMessage[]>(`/warmup-pairs/${pairId}/messages`));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      load();
      if (selectedRef.current) loadMessages(selectedRef.current.id);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function openPair(pair: WarmupPair) {
    setSelected(pair);
    await loadMessages(pair.id);
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 md:-m-8 flex bg-background">
      <div className="w-full md:w-80 border-r border-border overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="font-semibold">Conversas</h1>
          <p className="text-xs text-muted mt-1">
            Monitoramento das trocas de aquecimento entre seus números. Atendimento a clientes fica em{" "}
            <a href="/attendance" className="text-primary hover:underline">
              Atendimentos
            </a>
            .
          </p>
        </div>
        {pairs.map((pair) => (
          <button
            key={pair.id}
            onClick={() => openPair(pair)}
            className={`w-full text-left px-4 py-3 border-b border-border hover:bg-surfaceHover flex items-center gap-3 transition-colors ${
              selected?.id === pair.id ? "bg-surfaceHover" : ""
            }`}
          >
            <div className="flex -space-x-2 shrink-0">
              <Avatar name={pair.instanceA.name} size={32} />
              <Avatar name={pair.instanceB.name} size={32} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">
                {pair.instanceA.name} ⇄ {pair.instanceB.name}
              </div>
              <div className="text-xs text-muted">
                {pair.sentToday}/{pair.dailyMessageTarget} hoje
              </div>
            </div>
            <Badge status={pair.enabled ? "ACTIVE" : "PAUSED"} />
          </button>
        ))}
        {pairs.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={Flame}
              title="Nenhum par de aquecimento"
              description="Crie um par na Central de Aquecimento para começar a monitorar as trocas de mensagem."
            />
          </div>
        )}
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                <Avatar name={selected.instanceA.name} size={36} />
                <Avatar name={selected.instanceB.name} size={36} />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {selected.instanceA.name} ⇄ {selected.instanceB.name}
                </div>
                <div className="text-xs text-muted flex items-center gap-1">
                  <Radio size={11} /> atualiza automaticamente a cada 30s
                </div>
              </div>
            </div>
            <Badge status={selected.enabled ? "ACTIVE" : "PAUSED"} />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages
              .slice()
              .reverse()
              .map((m) => {
                const fromA = m.senderInstanceId === selected.instanceA.id;
                return (
                  <div key={m.id} className={`max-w-[70%] ${fromA ? "" : "ml-auto"}`}>
                    <div
                      className={`rounded-xl px-3 py-2 text-sm ${
                        fromA ? "bg-surface border border-border" : "bg-primary/15 text-white"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className={`text-xs mt-1 text-muted ${fromA ? "" : "text-right"}`}>
                      {fromA ? selected.instanceA.name : selected.instanceB.name} ·{" "}
                      {new Date(m.createdAt).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>
                );
              })}
            {messages.length === 0 && (
              <p className="text-sm text-muted text-center mt-8">Nenhuma mensagem trocada ainda.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">
          Selecione um par de aquecimento
        </div>
      )}
    </div>
  );
}
