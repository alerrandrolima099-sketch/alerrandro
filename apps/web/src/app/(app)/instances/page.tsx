"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Wifi, WifiOff, Trash2, Bot, Sparkles, Flame, Pause } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

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
};

type WarmupPairLite = {
  id: string;
  instanceA: { id: string };
  instanceB: { id: string };
  enabled: boolean;
  dailyMessageTarget: number;
  sentToday: number;
};

type AiDraft = { enabled: boolean; prompt: string };

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
function InstanceAvatar({ instance, size = 48 }: { instance: Instance; size?: number }) {
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

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [warmupByInstance, setWarmupByInstance] = useState<Record<string, WarmupPairLite>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("MOCK");
  const [busy, setBusy] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<Record<string, AiDraft>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const [data, pairs] = await Promise.all([
      api<Instance[]>("/instances"),
      api<WarmupPairLite[]>("/warmup-pairs").catch(() => [] as WarmupPairLite[]),
    ]);
    setInstances(data);

    // Mapa instanceId -> par de aquecimento (o card de cada número mostra um
    // indicador rápido de aquecimento, sem duplicar a tela de Aquecimento).
    const map: Record<string, WarmupPairLite> = {};
    for (const pair of pairs) {
      map[pair.instanceA.id] = pair;
      map[pair.instanceB.id] = pair;
    }
    setWarmupByInstance(map);

    // Só inicializa o rascunho de IA na primeira vez que vê cada instância -
    // não sobrescreve o que o usuário está digitando/marcando enquanto o
    // polling de QR Code roda em segundo plano.
    setAiDraft((prev) => {
      const next = { ...prev };
      for (const inst of data) {
        if (!(inst.id in next)) {
          next[inst.id] = { enabled: inst.aiAutoReplyEnabled, prompt: inst.aiSystemPrompt ?? "" };
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
    setAiDraft((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { enabled: false, prompt: "" }), ...patch } }));
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
          <p className="text-muted">Conecte, pause e acompanhe a saúde de cada número de WhatsApp.</p>
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
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map((inst) => {
            const showQr = inst.provider === "WHATSAPP_QR" && inst.status === "CONNECTING";
            const warmup = warmupByInstance[inst.id];
            return (
              <div
                key={inst.id}
                className="bg-surface border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors flex flex-col"
              >
                <div className="flex items-start gap-3 mb-4">
                  <InstanceAvatar instance={inst} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium truncate">{inst.name}</h3>
                      <Badge status={inst.status} />
                    </div>
                    <p className="text-xs text-muted mt-0.5">{PROVIDER_LABELS[inst.provider] ?? inst.provider}</p>
                  </div>
                </div>

                <div className="bg-background/60 border border-border rounded-lg px-3 py-2 mb-3 text-sm">
                  <div className="flex items-center justify-between text-muted text-xs mb-1">
                    <span>Número</span>
                    <span>Última atividade</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{inst.phoneNumber ?? "—"}</span>
                    <span className="text-xs text-muted">
                      {inst.lastActivityAt ? new Date(inst.lastActivityAt).toLocaleString("pt-BR") : "—"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3 text-xs">
                  <Flame size={12} className={warmup?.enabled ? "text-primary" : "text-muted"} />
                  <span className={warmup?.enabled ? "text-primary" : "text-muted"}>
                    {warmup
                      ? warmup.enabled
                        ? `Aquecendo: ${warmup.sentToday}/${warmup.dailyMessageTarget} hoje`
                        : "Aquecimento pausado"
                      : "Fora de aquecimento"}
                  </span>
                  <a href="/warmup" className="text-muted hover:text-primary hover:underline ml-auto">
                    {warmup ? "ver" : "aquecer"}
                  </a>
                </div>

                {inst.lastError && (
                  <p className="text-xs text-red-400 mb-3 bg-red-500/5 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                    {inst.lastError}
                  </p>
                )}

                {showQr && (
                  <div className="mb-4 flex flex-col items-center bg-background border border-border rounded-lg p-4">
                    {inst.qrCode ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={inst.qrCode} alt="QR Code do WhatsApp" className="w-44 h-44 rounded" />
                        <p className="text-xs text-muted mt-2 text-center">
                          Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho e escaneie.
                          O código expira em segundos; se sumir, clique em "Conectar" novamente.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted">Gerando QR Code, aguarde...</p>
                    )}
                  </div>
                )}

                <div className="mb-4 bg-background/60 border border-border rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiDraft[inst.id]?.enabled ?? inst.aiAutoReplyEnabled}
                      onChange={(e) => updateDraft(inst.id, { enabled: e.target.checked })}
                    />
                    <Bot size={14} className="text-primary" /> Resposta automática por IA (ChatGPT)
                  </label>
                  <p className="text-xs text-muted mt-1 mb-2">
                    Quando ligada, a IA responde automaticamente novas mensagens desta conversa (com um pequeno
                    atraso, como um atendente digitando), exceto quando um atendente humano assumir a conversa.
                  </p>
                  <textarea
                    value={aiDraft[inst.id]?.prompt ?? inst.aiSystemPrompt ?? ""}
                    onChange={(e) => updateDraft(inst.id, { prompt: e.target.value })}
                    placeholder="Persona / instruções da IA (opcional). Ex: Você é atendente da Loja X, responda de forma curta e cordial..."
                    rows={2}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-y transition-colors"
                  />
                  <button
                    disabled={busy === inst.id}
                    onClick={() => saveAiSettings(inst.id)}
                    className="mt-2 flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-primary/25 transition-colors"
                  >
                    <Sparkles size={12} /> Salvar IA
                  </button>
                </div>

                <div className="flex gap-2 mt-auto pt-1 flex-wrap">
                  {inst.status === "CONNECTED" ? (
                    <>
                      <button
                        disabled={busy === inst.id}
                        onClick={() => pause(inst.id)}
                        className="flex items-center gap-1.5 text-xs bg-blue-500/15 text-blue-400 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-blue-500/25 transition-colors"
                      >
                        <Pause size={14} /> Pausar
                      </button>
                      <button
                        disabled={busy === inst.id}
                        onClick={() => disconnect(inst.id)}
                        className="flex items-center gap-1.5 text-xs bg-gray-500/15 text-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-gray-500/25 transition-colors"
                      >
                        <WifiOff size={14} /> Desconectar
                      </button>
                    </>
                  ) : (
                    <button
                      disabled={busy === inst.id}
                      onClick={() => connect(inst.id)}
                      className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-primary/25 transition-colors"
                    >
                      <Wifi size={14} />
                      {showQr ? "Gerar novo QR Code" : inst.status === "PAUSED" ? "Retomar" : "Conectar"}
                    </button>
                  )}
                  <button
                    onClick={() => remove(inst.id)}
                    className="flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5 hover:bg-red-500/25 transition-colors"
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
