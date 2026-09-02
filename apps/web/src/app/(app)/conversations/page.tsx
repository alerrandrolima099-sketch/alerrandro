"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Pause, Play, Phone } from "lucide-react";
import { api, API_URL } from "@/lib/api";

type Conversation = {
  id: string;
  automationPaused: boolean;
  contact: { id: string; name: string; phone: string };
  instance: { id: string; name: string };
  messages: { content: string; createdAt: string }[];
};

type Message = { id: string; direction: "INBOUND" | "OUTBOUND"; content: string; status: string; createdAt: string };

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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const selectedRef = useRef<Conversation | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  async function load() {
    const data = await api<Conversation[]>("/conversations");
    setConversations(data);
  }

  async function refreshOpenMessages(conversationId: string) {
    setMessages(await api<Message[]>(`/conversations/${conversationId}/messages`));
  }

  useEffect(() => {
    load();
  }, []);

  // Tempo real (seção 36): conecta ao gateway WebSocket da API e escuta o
  // evento "conversation:message" - disparado sempre que uma conversa tem
  // mensagem nova, não importa a origem (contato respondendo, atendente
  // enviando manualmente, automação ou resposta automática por IA). O
  // payload só carrega o conversationId de propósito (evita duplicar o
  // formato de Message no front-end): sempre recarrega a lista (pra
  // reordenar/atualizar a prévia) e, se for a conversa aberta no momento,
  // recarrega as mensagens dela também.
  useEffect(() => {
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (!accessToken) return;

    // O token de acesso expira periodicamente e é renovado sozinho pelas
    // chamadas normais da API (ver tryRefresh em lib/api.ts), que atualizam
    // o localStorage. Usar uma função aqui (em vez de um objeto fixo) faz o
    // socket.io reler o token mais atual do localStorage a cada tentativa
    // de (re)conexão - sem isso, depois que o token expirasse uma vez o
    // WebSocket ficaria preso tentando reconectar com um token velho para
    // sempre, mesmo com o resto do app já renovado e funcionando.
    const socket: Socket = io(API_URL, {
      auth: (cb) => cb({ token: localStorage.getItem("accessToken") }),
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));
    socket.on("conversation:message", (payload: { conversationId: string }) => {
      load();
      if (selectedRef.current?.id === payload.conversationId) {
        refreshOpenMessages(payload.conversationId);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function openConversation(c: Conversation) {
    setSelected(c);
    await refreshOpenMessages(c.id);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    await api(`/conversations/${selected.id}/messages`, { method: "POST", body: { content: draft } });
    setDraft("");
    await refreshOpenMessages(selected.id);
  }

  async function toggleAutomation() {
    if (!selected) return;
    const path = selected.automationPaused ? "resume" : "pause";
    await api(`/conversations/${selected.id}/automation/${path}`, { method: "POST" });
    await load();
    setSelected({ ...selected, automationPaused: !selected.automationPaused });
  }

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 md:-m-8 flex bg-background">
      <div className="w-full md:w-80 border-r border-border overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="font-semibold">Conversas</h1>
          <span
            className={`flex items-center gap-1.5 text-xs ${live ? "text-emerald-400" : "text-muted"}`}
            title={live ? "Atualizações em tempo real conectadas" : "Conectando ao tempo real..."}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
            {live ? "Ao vivo" : "..."}
          </span>
        </div>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => openConversation(c)}
            className={`w-full text-left px-4 py-3 border-b border-border hover:bg-surfaceHover flex items-center gap-3 transition-colors ${
              selected?.id === c.id ? "bg-surfaceHover" : ""
            }`}
          >
            <Avatar name={c.contact.name} size={38} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm truncate">{c.contact.name}</div>
              <div className="text-xs text-muted">{c.contact.phone}</div>
              {c.messages[0] && <div className="text-xs text-muted truncate mt-1">{c.messages[0].content}</div>}
            </div>
          </button>
        ))}
        {conversations.length === 0 && <p className="p-4 text-sm text-muted">Nenhuma conversa ainda.</p>}
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={selected.contact.name} size={40} />
              <div className="min-w-0">
                <div className="font-medium truncate">{selected.contact.name}</div>
                <div className="text-xs text-muted flex items-center gap-1">
                  <Phone size={11} /> {selected.contact.phone} · {selected.instance.name}
                </div>
              </div>
            </div>
            <button
              onClick={toggleAutomation}
              className="flex items-center gap-2 text-xs bg-surfaceHover rounded-lg px-3 py-1.5 shrink-0"
            >
              {selected.automationPaused ? <Play size={14} /> : <Pause size={14} />}
              {selected.automationPaused ? "Retomar automação" : "Pausar automação"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[70%] ${m.direction === "OUTBOUND" ? "ml-auto" : ""}`}>
                <div
                  className={`rounded-xl px-3 py-2 text-sm ${
                    m.direction === "OUTBOUND" ? "bg-primary/15 text-white" : "bg-surface border border-border"
                  }`}
                >
                  {m.content}
                </div>
                <div className={`text-xs text-muted mt-1 ${m.direction === "OUTBOUND" ? "text-right" : ""}`}>
                  {new Date(m.createdAt).toLocaleTimeString("pt-BR")} · {m.status}
                </div>
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm text-muted text-center mt-8">Nenhuma mensagem ainda.</p>}
          </div>

          <form onSubmit={send} className="p-4 border-t border-border flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem (atendimento manual)..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
              <Send size={14} /> Enviar
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">Selecione uma conversa</div>
      )}
    </div>
  );
}
