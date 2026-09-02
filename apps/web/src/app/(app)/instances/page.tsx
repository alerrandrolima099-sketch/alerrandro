"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Wifi, WifiOff, Trash2, Bot } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Instance = {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  provider: string;
  qrCode: string | null;
  lastError: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  aiAutoReplyEnabled: boolean;
  aiSystemPrompt: string | null;
};

type AiDraft = { enabled: boolean; prompt: string };

const PROVIDER_OPTIONS = [
  { value: "MOCK", label: "Mock (testes, sem WhatsApp real)" },
  { value: "WHATSAPP_CLOUD_API", label: "WhatsApp Business Cloud API (oficial)" },
  { value: "WHATSAPP_QR", label: "WhatsApp via QR Code (não oficial)" },
];

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("MOCK");
  const [busy, setBusy] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<Record<string, AiDraft>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const data = await api<Instance[]>("/instances");
    setInstances(data);
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
          <h1 className="text-2xl font-semibold mb-1">Instâncias</h1>
          <p className="text-muted">Gerencie suas conexões de WhatsApp Business.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm"
        >
          <Plus size={16} /> Nova instância
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
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Ex: Atendimento Comercial"
            />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-sm text-muted block mb-1.5">Provedor</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
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

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instances.map((inst) => {
          const showQr = inst.provider === "WHATSAPP_QR" && inst.status === "CONNECTING";
          return (
            <div key={inst.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{inst.name}</h3>
                <Badge status={inst.status} />
              </div>
              <p className="text-sm text-muted mb-1">Número: {inst.phoneNumber ?? "—"}</p>
              <p className="text-sm text-muted mb-1">Provedor: {inst.provider}</p>
              {inst.lastError && <p className="text-sm text-red-400 mb-1">Erro: {inst.lastError}</p>}
              <p className="text-xs text-muted mb-4">
                Última atividade: {inst.lastActivityAt ? new Date(inst.lastActivityAt).toLocaleString("pt-BR") : "—"}
              </p>

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

              <div className="mb-4 bg-background border border-border rounded-lg p-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiDraft[inst.id]?.enabled ?? inst.aiAutoReplyEnabled}
                    onChange={(e) => updateDraft(inst.id, { enabled: e.target.checked })}
                  />
                  <Bot size={14} /> Resposta automática por IA (ChatGPT)
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
                  className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-primary resize-y"
                />
                <button
                  disabled={busy === inst.id}
                  onClick={() => saveAiSettings(inst.id)}
                  className="mt-2 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  Salvar IA
                </button>
              </div>

              <div className="flex gap-2">
                {inst.status !== "CONNECTED" ? (
                  <button
                    disabled={busy === inst.id}
                    onClick={() => connect(inst.id)}
                    className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    <Wifi size={14} /> {showQr ? "Gerar novo QR Code" : "Conectar"}
                  </button>
                ) : (
                  <button
                    disabled={busy === inst.id}
                    onClick={() => disconnect(inst.id)}
                    className="flex items-center gap-1.5 text-xs bg-gray-500/15 text-gray-300 rounded-lg px-3 py-1.5 disabled:opacity-50"
                  >
                    <WifiOff size={14} /> Desconectar
                  </button>
                )}
                <button
                  onClick={() => remove(inst.id)}
                  className="flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </div>
          );
        })}

        {instances.length === 0 && (
          <p className="text-muted text-sm col-span-full">Nenhuma instância cadastrada ainda. Clique em "Nova instância" para começar.</p>
        )}
      </div>
    </div>
  );
}
