"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus, Wifi, WifiOff, Trash2, Bot, Sparkles, Flame, Pause, MoreVertical, Users, MessageCircle, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

type Evolution7d = { status: "ok"; pct: number; direction: "up" | "down" | "flat" } | { status: "insufficient" };

// Instância enriquecida (seção 39) - os campos abaixo de "createdAt" em
// diante não existem na tabela: são calculados em tempo real pelo backend
// (ver apps/api/src/modules/instances/instanceHealth.ts) a partir de dados
// reais (logs, mensagens, grupos, pares de aquecimento). Nada é inventado.
type Instance = {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  provider: string;
  qrCode: string | null;
  profilePicUrl: string | null;
  lastError: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  aiAutoReplyEnabled: boolean;
  aiSystemPrompt: string | null;
  personaId: string | null;
  healthScore: number;
  healthTier: "GOOD" | "ATTENTION" | "CRITICAL";
  healthTierLabel: string;
  healthColor: "green" | "yellow" | "red";
  warmupLevel: number;
  warmupTier: "STARTING" | "WARMING" | "WARM" | "VERY_WARM";
  warmupTierLabel: string;
  warmupColor: "blue" | "orange" | "yellow" | "green";
  daysWarming: number;
  warmupStatus: "NONE" | "ACTIVE" | "PAUSED" | "ISSUE";
  groupsJoined: number;
  messagesReceived: number;
  evolution7d: Evolution7d;
  active: boolean;
};

type PersonaLite = { id: string; name: string };

type AiDraft = { enabled: boolean; prompt: string; personaId: string | null };

const PROVIDER_OPTIONS = [
  { value: "MOCK", label: "Mock (testes, sem WhatsApp real)" },
  { value: "WHATSAPP_CLOUD_API", label: "WhatsApp Business Cloud API (oficial)" },
  { value: "WHATSAPP_QR", label: "WhatsApp via QR Code (não oficial)" },
];

const PROVIDER_LABELS: Record<string, string> = {
  MOCK: "Mock",
  WHATSAPP_CLOUD_API: "Cloud API (oficial)",
  WHATSAPP_QR: "QR Code (não oficial)",
};

const WARMUP_TEXT: Record<Instance["warmupColor"], string> = {
  blue: "text-blue-400",
  orange: "text-orange-400",
  yellow: "text-yellow-400",
  green: "text-green-400",
};
const WARMUP_BG: Record<Instance["warmupColor"], string> = {
  blue: "bg-blue-400",
  orange: "bg-orange-400",
  yellow: "bg-yellow-400",
  green: "bg-green-400",
};
const HEALTH_TEXT: Record<Instance["healthColor"], string> = {
  green: "text-green-400",
  yellow: "text-yellow-400",
  red: "text-red-400",
};
const HEALTH_BG: Record<Instance["healthColor"], string> = {
  green: "bg-green-400",
  yellow: "bg-yellow-400",
  red: "bg-red-400",
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

// Foto de perfil do WhatsApp (seção 36): só existe para instâncias
// WHATSAPP_QR que conseguiram buscá-la (melhor esforço, best-effort) - nos
// demais casos cai no círculo com gradiente + iniciais.
function InstanceAvatar({ instance, size = 40 }: { instance: Instance; size?: number }) {
  if (instance.profilePicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={instance.profilePicUrl}
        alt={`Foto de perfil de ${instance.name}`}
        className="rounded-full object-cover shrink-0 ring-2 ring-border"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(instance.name)} text-white font-semibold shrink-0 ring-2 ring-border`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(instance.name)}
    </div>
  );
}

function pluralize(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

// Barra compacta de progresso 0-100 reutilizada por saúde e nível de
// aquecimento (seção 39) - mesmo padrão visual da barra de aquecimento que
// já existia no Dashboard.
function MeterBar({ pct, colorBg }: { pct: number; colorBg: string }) {
  return (
    <div className="h-1.5 bg-background rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorBg}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [personas, setPersonas] = useState<PersonaLite[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("MOCK");
  const [busy, setBusy] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<Record<string, AiDraft>>({});
  const [aiOpen, setAiOpen] = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Total de números conectados e ativos agora - pedido explícito do
  // usuário no topo da página, além do card "Números ativos" que já existe
  // no Dashboard. Derivado da própria lista já carregada, sem chamada nova.
  const activeCount = instances.filter((i) => i.active).length;

  async function load() {
    const [data, personasData] = await Promise.all([
      api<Instance[]>("/instances"),
      api<PersonaLite[]>("/personas").catch(() => [] as PersonaLite[]),
    ]);
    setInstances(data);
    setPersonas(personasData);

    // Só inicializa o rascunho de IA na primeira vez que vê cada instância -
    // não sobrescreve o que o usuário está digitando/marcando enquanto o
    // polling de QR Code roda em segundo plano.
    setAiDraft((prev) => {
      const next = { ...prev };
      for (const inst of data) {
        if (!(inst.id in next)) {
          next[inst.id] = { enabled: inst.aiAutoReplyEnabled, prompt: inst.aiSystemPrompt ?? "", personaId: inst.personaId };
        }
      }
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  // Enquanto alguma instância WHATSAPP_QR estiver "CONNECTING" (aguardando o
  // usuário escanear o QR Code, ou aguardando o worker gerar o QR Code),
  // faz polling para atualizar o QR Code exibido e detectar quando conectar.
  useEffect(() => {
    const hasPending = instances.some((i) => i.provider === "WHATSAPP_QR" && i.status === "CONNECTING");

    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    }
    if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [instances]);

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    await api("/instances", { method: "POST", body: { name, provider } });
    setName("");
    setProvider("MOCK");
    setShowCreate(false);
    await load();
  }

  async function connect(id: string) {
    setBusy(id);
    try {
      await api(`/instances/${id}/connect`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    setBusy(id);
    try {
      await api(`/instances/${id}/disconnect`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  // Pausa (seção 38): mantém a sessão do WhatsApp como está, só marca a
  // instância como indisponível para uso (aquecimento, automações, novos
  // atendimentos) até o usuário retomar. Diferente de desconectar, que
  // encerra a sessão de fato.
  async function pause(id: string) {
    setBusy(id);
    try {
      await api(`/instances/${id}/pause`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta instância?")) return;
    await api(`/instances/${id}`, { method: "DELETE" });
    await load();
  }

  function updateDraft(id: string, patch: Partial<AiDraft>) {
    setAiDraft((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { enabled: false, prompt: "", personaId: null }), ...patch },
    }));
  }

  // Resposta automática por IA (ChatGPT) nas Conversas - seção 34. Envia com
  // um atraso e limite por hora definidos no backend para simular tempo de
  // digitação humano, nunca instantâneo.
  async function saveAiSettings(id: string) {
    const draft = aiDraft[id];
    if (!draft) return;
    setBusy(id);
    try {
      await api(`/instances/${id}/ai-settings`, {
        method: "PATCH",
        body: {
          aiAutoReplyEnabled: draft.enabled,
          aiSystemPrompt: draft.prompt.trim() ? draft.prompt : null,
          personaId: draft.personaId,
        },
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Meus Números</h1>
          <p className="text-muted">Conecte, pause e acompanhe a saúde e o aquecimento de cada número.</p>
          {instances.length > 0 && (
            <p className="text-sm mt-1.5">
              <span className="text-green-400 font-medium">{activeCount}</span>
              <span className="text-muted"> de {instances.length} números conectados e ativos</span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={16} /> Novo número
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createInstance} className="bg-surface border border-border rounded-xl p-4 mb-6 flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-muted block mb-1.5">Nome da instância</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              placeholder="Ex: Atendimento Comercial"
            />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-sm text-muted block mb-1.5">Provedor</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {provider === "WHATSAPP_QR" && (
              <p className="text-xs text-yellow-400 mt-1.5">
                Não oficial: usa o mesmo mecanismo do WhatsApp Web. Viola os Termos do WhatsApp e o número
                corre risco de bloqueio. Use por sua conta e risco.
              </p>
            )}
          </div>
          <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Criar</button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
            Cancelar
          </button>
        </form>
      )}

      {instances.length === 0 ? (
        <EmptyState
          icon={Wifi}
          title="Nenhum número cadastrado ainda"
          description="Adicione seu primeiro número de WhatsApp para começar a conectar, aquecer e automatizar."
          action={
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium mx-auto"
            >
              <Plus size={16} /> Novo número
            </button>
          }
        />
      ) : (
        <>
          {/* Grade compacta e responsiva (seção 39): 1 coluna no celular, 2-3
              no tablet, 4-5 no desktop - cards pequenos lado a lado, em vez
              dos cards enormes que ocupavam quase a largura toda. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {instances.map((inst: Instance) => {
              const showQr = inst.provider === "WHATSAPP_QR" && inst.status === "CONNECTING";
              const statusLabel = inst.status === "PAUSED" ? "⏸️ Pausado" : inst.active ? "🟢 Ativo" : "🔴 Desconectado";

              return (
                <div
                  key={inst.id}
                  className="bg-surface border border-border rounded-xl p-3.5 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card transition-all flex flex-col"
                >
                  <div className="flex items-start gap-2.5 mb-2.5">
                    <InstanceAvatar instance={inst} size={36} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium truncate">{inst.name}</h3>
                      <p className="text-xs text-muted truncate">{inst.phoneNumber ?? "—"}</p>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={() => setOpenMenu(openMenu === inst.id ? null : inst.id)}
                        className="text-muted hover:text-white p-1 rounded-lg hover:bg-surfaceHover transition-colors"
                        aria-label="Ações do número"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openMenu === inst.id && (
                        <div className="absolute right-0 top-8 z-20 w-48 bg-surface2 border border-border rounded-lg shadow-card py-1 text-xs">
                          {inst.status === "CONNECTED" && (
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                pause(inst.id);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-blue-400"
                            >
                              <Pause size={13} /> Pausar
                            </button>
                          )}
                          {inst.status === "CONNECTED" && (
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                disconnect(inst.id);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-gray-300"
                            >
                              <WifiOff size={13} /> Desconectar
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              setAiOpen((prev) => ({ ...prev, [inst.id]: !prev[inst.id] }));
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-primary"
                          >
                            <Bot size={13} /> {aiOpen[inst.id] ? "Fechar IA" : "Configurar IA"}
                          </button>
                          <a href="/warmup" className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-orange-400">
                            <Flame size={13} /> Ver aquecimento
                          </a>
                          <button
                            onClick={() => {
                              setOpenMenu(null);
                              remove(inst.id);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-surfaceHover flex items-center gap-2 text-red-400 border-t border-border mt-1"
                          >
                            <Trash2 size={13} /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-2.5">
                    <Badge status={inst.status} />
                  </div>

                  {inst.lastError && (
                    <p className="text-[11px] text-red-400 mb-2.5 bg-red-500/5 border border-red-500/20 rounded-lg px-2 py-1.5 line-clamp-2">
                      {inst.lastError}
                    </p>
                  )}

                  {showQr && (
                    <div className="mb-3 flex flex-col items-center bg-background border border-border rounded-lg p-3">
                      {inst.qrCode ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={inst.qrCode} alt="QR Code do WhatsApp" className="w-36 h-36 rounded" />
                          <p className="text-[11px] text-muted mt-2 text-center">
                            WhatsApp → Aparelhos conectados → Conectar um aparelho. O código expira em segundos.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted">Gerando QR Code, aguarde...</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 mb-2.5 text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                      <Flame size={12} className="text-orange-400 shrink-0" />
                      {inst.daysWarming} {pluralize(inst.daysWarming, "dia", "dias")} aquecendo
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={12} className="shrink-0" />
                      {inst.groupsJoined} {pluralize(inst.groupsJoined, "grupo", "grupos")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle size={12} className="shrink-0" />
                      {inst.messagesReceived} {pluralize(inst.messagesReceived, "mensagem recebida", "mensagens recebidas")}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted">Nível de aquecimento</span>
                      <span className={WARMUP_TEXT[inst.warmupColor]}>
                        {inst.warmupLevel}% {inst.warmupTierLabel}
                      </span>
                    </div>
                    <MeterBar pct={inst.warmupLevel} colorBg={WARMUP_BG[inst.warmupColor]} />
                  </div>

                  <div className="mb-2.5">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-muted">Saúde</span>
                      <span className={HEALTH_TEXT[inst.healthColor]}>
                        {inst.healthScore}/100 {inst.healthTierLabel}
                      </span>
                    </div>
                    <MeterBar pct={inst.healthScore} colorBg={HEALTH_BG[inst.healthColor]} />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs mb-2.5">
                    {inst.evolution7d.status === "ok" ? (
                      <>
                        {inst.evolution7d.direction === "up" && <TrendingUp size={12} className="text-green-400 shrink-0" />}
                        {inst.evolution7d.direction === "down" && <TrendingDown size={12} className="text-red-400 shrink-0" />}
                        {inst.evolution7d.direction === "flat" && <Minus size={12} className="text-muted shrink-0" />}
                        <span
                          className={
                            inst.evolution7d.direction === "up"
                              ? "text-green-400"
                              : inst.evolution7d.direction === "down"
                              ? "text-red-400"
                              : "text-muted"
                          }
                        >
                          {inst.evolution7d.pct > 0 ? "+" : ""}
                          {inst.evolution7d.pct}% nos últimos 7 dias
                        </span>
                      </>
                    ) : (
                      <>
                        <Minus size={12} className="text-muted shrink-0" />
                        <span className="text-muted">Dados insuficientes</span>
                      </>
                    )}
                  </div>

                  <div className="mt-auto pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted gap-2">
                    <span className="shrink-0">{statusLabel}</span>
                    <span className="truncate">
                      {inst.lastActivityAt
                        ? new Date(inst.lastActivityAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Sem atividade"}
                    </span>
                  </div>

                  {!inst.active && (
                    <button
                      disabled={busy === inst.id}
                      onClick={() => connect(inst.id)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-primary/25 transition-colors"
                    >
                      <Wifi size={13} />
                      {showQr ? "Gerar novo QR Code" : inst.status === "PAUSED" ? "Retomar" : "Conectar"}
                    </button>
                  )}

                  {aiOpen[inst.id] && (
                    <div className="mt-2.5 bg-background/60 border border-border rounded-lg p-3">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiDraft[inst.id]?.enabled ?? inst.aiAutoReplyEnabled}
                          onChange={(e) => updateDraft(inst.id, { enabled: e.target.checked })}
                        />
                        <Bot size={13} className="text-primary" /> Resposta automática por IA
                      </label>
                      <select
                        value={aiDraft[inst.id]?.personaId ?? inst.personaId ?? ""}
                        onChange={(e) => updateDraft(inst.id, { personaId: e.target.value || null })}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary transition-colors mt-2 mb-2"
                      >
                        <option value="">Sem perfil (usar só o texto abaixo, se houver)</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={aiDraft[inst.id]?.prompt ?? inst.aiSystemPrompt ?? ""}
                        onChange={(e) => updateDraft(inst.id, { prompt: e.target.value })}
                        placeholder="Texto livre (opcional) - tem prioridade sobre o perfil selecionado."
                        rows={2}
                        className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-y transition-colors"
                      />
                      <p className="text-[11px] text-muted mt-1">
                        Gerencie os perfis em{" "}
                        <a href="/personas" className="text-primary hover:underline">
                          Perfis de Conversa
                        </a>
                        .
                      </p>
                      <button
                        disabled={busy === inst.id}
                        onClick={() => saveAiSettings(inst.id)}
                        className="mt-2 flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-primary/25 transition-colors"
                      >
                        <Sparkles size={12} /> Salvar IA
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fecha o menu "⋯" ao clicar fora dele. */}
          {openMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}
        </>
      )}
    </div>
  );
}
