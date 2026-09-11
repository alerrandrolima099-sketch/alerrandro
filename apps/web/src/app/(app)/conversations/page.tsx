"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  Send,
  Pause,
  Play,
  Phone,
  AlertCircle,
  RotateCw,
  Search,
  Plus,
  Filter,
  Calendar,
  Tag as TagIcon,
  X,
  Paperclip,
  Image as ImageIcon,
  DollarSign,
  Smile,
  Mic,
  Copy,
  ChevronDown,
} from "lucide-react";
import { api, API_URL } from "@/lib/api";

// Conversas (seções 38/43/45): inbox de clientes (leads), com
// envio/recebimento ao vivo via WebSocket e retry de mensagem falhada. A
// partir da seção 45 ganhou o formato de "central de tickets" (a pedido do
// usuário, inspirado numa ferramenta de referência): cada conversa tem um
// status de atendimento (Aguardando/Atendendo/Resolvidos), pode ganhar
// etiquetas (reaproveita Contact.tags, que já existia para automação) e um
// número de ticket. Nada do que já funcionava foi removido: envio manual,
// pausa de automação e retry de FAILED continuam 100% iguais.

type TicketStatus = "AGUARDANDO" | "ATENDENDO" | "RESOLVIDO";

type Instance = { id: string; name: string; deviceLabel: string | null };

type Conversation = {
  id: string;
  ticketNumber: number;
  ticketStatus: TicketStatus;
  unread: boolean;
  automationPaused: boolean;
  contact: { id: string; name: string; phone: string; profilePicUrl: string | null; tags: string[] };
  instance: Instance;
  messages: { direction: "INBOUND" | "OUTBOUND"; content: string; createdAt: string }[];
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

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash);
}

function avatarGradient(seed: string) {
  return AVATAR_GRADIENTS[hashSeed(seed) % AVATAR_GRADIENTS.length];
}

// Cor da etiqueta/badge de instância (ex: "CEL-5") por hash do texto - só
// pra distinguir números/etiquetas diferentes de relance, sem tabela de
// cores fixa pra manter/cadastrar.
const TAG_PILLS = [
  "bg-violet-500/15 text-violet-300 border-violet-500/25",
  "bg-sky-500/15 text-sky-300 border-sky-500/25",
  "bg-amber-500/15 text-amber-300 border-amber-500/25",
  "bg-rose-500/15 text-rose-300 border-rose-500/25",
  "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
];

function pillClass(seed: string) {
  return TAG_PILLS[hashSeed(seed) % TAG_PILLS.length];
}

// Foto de perfil do lead (seção 44): quando o WhatsApp tem uma foto
// acessível para esse contato, mostra ela; senão cai no círculo com
// gradiente + iniciais de sempre. onError cobre o caso da URL parar de
// funcionar depois de salva (contato trocou/removeu a foto, ou mudou a
// privacidade) - sem isso a imagem quebrada ficaria visível pra sempre em
// vez de voltar pro círculo.
function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (photoUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Foto de perfil de ${name}`}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(name)} text-white font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

const TABS: { key: TicketStatus; label: string }[] = [
  { key: "AGUARDANDO", label: "Aguardando" },
  { key: "ATENDENDO", label: "Atendendo" },
  { key: "RESOLVIDO", label: "Resolvidos" },
];

const SUB_FILTERS = [
  { key: "TODAS", label: "Tudo" },
  { key: "NAO_LIDAS", label: "Não lidas" },
  { key: "NAO_RESPONDIDAS", label: "Não respondidas" },
] as const;

const STATUS_DOT: Record<TicketStatus, string> = {
  AGUARDANDO: "bg-yellow-400",
  ATENDENDO: "bg-blue-400",
  RESOLVIDO: "bg-green-400",
};

// Ícones do rodapé de envio (anexo/imagem/cobrança/emoji/áudio): reproduzem
// o layout da referência, mas nenhum tem funcionalidade real ainda (o
// provedor de mensageria hoje só envia texto) - ficam desabilitados com uma
// dica "em breve" em vez de fingir que funcionam.
function ComposerIconButton({ icon: Icon, title }: { icon: typeof Paperclip; title: string }) {
  return (
    <button
      type="button"
      disabled
      title={`${title} (em breve)`}
      className="p-2 rounded-lg text-muted/60 cursor-not-allowed"
    >
      <Icon size={16} />
    </button>
  );
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [live, setLive] = useState(false);
  const [activeTab, setActiveTab] = useState<TicketStatus>("AGUARDANDO");
  const [subFilter, setSubFilter] = useState<(typeof SUB_FILTERS)[number]["key"]>("TODAS");
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [openMessageMenu, setOpenMessageMenu] = useState<string | null>(null);
  const selectedRef = useRef<Conversation | null>(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  async function load() {
    const data = await api<Conversation[]>("/conversations");
    setConversations(data);
    return data;
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
  // enviando manualmente, automação ou resposta automática por IA). Se for
  // a conversa aberta no momento, recarrega as mensagens dela PRIMEIRO
  // (isso também marca como lida no backend, ver
  // conversations.service.getMessages) e só depois recarrega a lista - pra
  // ela já vir com o indicador de "não lida" correto.
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
    socket.on("conversation:message", async (payload: { conversationId: string }) => {
      if (selectedRef.current?.id === payload.conversationId) {
        await refreshOpenMessages(payload.conversationId);
      }
      load();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function openConversation(c: Conversation) {
    setSelected(c);
    setOpenMessageMenu(null);
    await refreshOpenMessages(c.id);
    if (c.unread) {
      setConversations((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: false } : x)));
    }
  }

  async function sendContent(content: string) {
    if (!selected || !content.trim()) return;
    await api(`/conversations/${selected.id}/messages`, { method: "POST", body: { content } });
    await refreshOpenMessages(selected.id);
    const data = await load();
    const fresh = data.find((c) => c.id === selected.id);
    if (fresh) setSelected(fresh);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await sendContent(draft);
    setDraft("");
  }

  // Reenviar uma mensagem que falhou (ex: a instância caiu no meio do
  // atendimento - agora com reconexão automática isso deve ser raro, mas o
  // atendente não deveria precisar redigitar o texto pra tentar de novo.
  async function resend(content: string) {
    await sendContent(content);
  }

  const STATUS_LABEL: Record<string, string> = {
    QUEUED: "enviando...",
    SENT: "enviada",
    DELIVERED: "entregue",
    READ: "lida",
    FAILED: "falhou ao enviar",
  };

  async function toggleAutomation() {
    if (!selected) return;
    const path = selected.automationPaused ? "resume" : "pause";
    await api(`/conversations/${selected.id}/automation/${path}`, { method: "POST" });
    await load();
    setSelected({ ...selected, automationPaused: !selected.automationPaused });
  }

  // Move o ticket entre as abas Aguardando/Atendendo/Resolvidos - ação
  // manual do atendente (clicando no pill de status no cabeçalho).
  async function changeTicketStatus(status: TicketStatus) {
    if (!selected) return;
    await api(`/conversations/${selected.id}/status`, { method: "POST", body: { status } });
    setSelected({ ...selected, ticketStatus: status });
    setConversations((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ticketStatus: status } : c)));
  }

  // Etiquetas (seção 45): reaproveita Contact.tags, que já existia pro node
  // TAG_CONTACT das automações - aqui só dá uma interface visual pra ele.
  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newTag.trim()) return;
    const updated = await api<{ tags: string[] }>(`/contacts/${selected.contact.id}/tags`, {
      method: "POST",
      body: { tag: newTag.trim() },
    });
    setSelected({ ...selected, contact: { ...selected.contact, tags: updated.tags } });
    setNewTag("");
  }

  async function removeTag(tag: string) {
    if (!selected) return;
    const updated = await api<{ tags: string[] }>(`/contacts/${selected.contact.id}/tags/${encodeURIComponent(tag)}`, {
      method: "DELETE",
    });
    setSelected({ ...selected, contact: { ...selected.contact, tags: updated.tags } });
  }

  function copyMessage(content: string) {
    navigator.clipboard?.writeText(content).catch(() => {});
    setOpenMessageMenu(null);
  }

  const counts = TABS.reduce<Record<TicketStatus, number>>(
    (acc, t) => ({ ...acc, [t.key]: conversations.filter((c) => c.ticketStatus === t.key).length }),
    { AGUARDANDO: 0, ATENDENDO: 0, RESOLVIDO: 0 }
  );

  const filtered = conversations
    .filter((c) => c.ticketStatus === activeTab)
    .filter((c) => (subFilter === "NAO_LIDAS" ? c.unread : true))
    .filter((c) => (subFilter === "NAO_RESPONDIDAS" ? c.messages[0]?.direction === "INBOUND" : true))
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return c.contact.name.toLowerCase().includes(q) || c.contact.phone.includes(q);
    });

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 md:-m-8 flex bg-background">
      <div className="w-full md:w-96 border-r border-border overflow-y-auto flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold">Conversas</h1>
            <span
              className={`flex items-center gap-1.5 text-xs ${live ? "text-emerald-400" : "text-muted"}`}
              title={live ? "Atualizações em tempo real conectadas" : "Conectando ao tempo real..."}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-400 animate-pulse" : "bg-gray-500"}`} />
              {live ? "Ao vivo" : "..."}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou telefone..."
                className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              onClick={() => setShowNewConversation(true)}
              title="Nova conversa"
              className="p-2 rounded-lg bg-primary text-white shrink-0"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => {
                setSubFilter("TODAS");
                setSearch("");
              }}
              title="Limpar filtros"
              className="p-2 rounded-lg bg-surfaceHover text-muted shrink-0"
            >
              <Filter size={15} />
            </button>
          </div>
        </div>

        <div className="flex border-b border-border shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 px-2 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t.key ? "border-primary text-white" : "border-transparent text-muted hover:text-white"
              }`}
            >
              {t.label} <span className="text-[10px] text-muted">({counts[t.key]})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {SUB_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSubFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                subFilter === f.key
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-transparent border-border text-muted hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            title="Filtrar por período (em breve)"
            disabled
            className="ml-auto p-1.5 rounded-lg text-muted/60 cursor-not-allowed"
          >
            <Calendar size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const deviceTag = c.instance.deviceLabel || c.instance.name;
            const last = c.messages[0];
            return (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={`w-full text-left px-4 py-3 border-b border-border hover:bg-surfaceHover flex items-center gap-3 transition-colors ${
                  selected?.id === c.id ? "bg-surfaceHover" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar name={c.contact.name} photoUrl={c.contact.profilePicUrl} size={38} />
                  {c.unread && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-sm truncate ${c.unread ? "font-semibold text-white" : "font-medium"}`}>
                      {c.contact.name}
                    </div>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${pillClass(c.instance.id)}`}>
                      {deviceTag}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <div className={`text-xs truncate ${c.unread ? "text-white/80" : "text-muted"}`}>
                      {last?.content ?? "Nenhuma mensagem ainda."}
                    </div>
                    {last && (
                      <span className="shrink-0 text-[10px] text-muted">
                        {new Date(last.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-muted">
              Nenhuma conversa{" "}
              {activeTab === "AGUARDANDO" ? "aguardando" : activeTab === "ATENDENDO" ? "em atendimento" : "resolvida"}.
            </p>
          )}
        </div>
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={selected.contact.name} photoUrl={selected.contact.profilePicUrl} size={40} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{selected.contact.name}</span>
                    <span className="text-xs text-muted shrink-0">#{selected.ticketNumber}</span>
                  </div>
                  <div className="text-xs text-muted flex items-center gap-1">
                    <Phone size={11} /> {selected.contact.phone} · {selected.instance.deviceLabel || selected.instance.name}
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

            <div className="flex items-center gap-1.5 mt-3">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => changeTicketStatus(t.key)}
                  title="Mudar status do ticket"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    selected.ticketStatus === t.key
                      ? "bg-surfaceHover border-white/20 text-white"
                      : "bg-transparent border-border text-muted hover:text-white"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.key]}`} />
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <TagIcon size={12} className="text-muted shrink-0" />
              {selected.contact.tags.length === 0 && !newTag && (
                <span className="text-xs text-muted italic">Nenhuma etiqueta aplicada</span>
              )}
              {selected.contact.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${pillClass(tag)}`}
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} title="Remover etiqueta">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <form onSubmit={addTag} className="inline-flex">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="+ etiqueta"
                  className="w-24 bg-transparent border-b border-dashed border-border text-[11px] px-1 py-0.5 outline-none focus:border-primary"
                />
              </form>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => {
              const failed = m.direction === "OUTBOUND" && m.status === "FAILED";
              const isMenuOpen = openMessageMenu === m.id;
              return (
                <div key={m.id} className={`max-w-[70%] group relative ${m.direction === "OUTBOUND" ? "ml-auto" : ""}`}>
                  <div
                    className={`rounded-xl px-3 py-2 text-sm flex items-start gap-2 ${
                      failed
                        ? "bg-red-500/10 border border-red-500/40 text-white"
                        : m.direction === "OUTBOUND"
                        ? "bg-primary/15 text-white"
                        : "bg-surface border border-border"
                    }`}
                  >
                    <span className="flex-1 whitespace-pre-wrap break-words">{m.content}</span>
                    <button
                      onClick={() => setOpenMessageMenu(isMenuOpen ? null : m.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted shrink-0"
                      title="Ações da mensagem"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>
                  {isMenuOpen && (
                    <div
                      className={`absolute z-10 mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 text-xs ${
                        m.direction === "OUTBOUND" ? "right-0" : "left-0"
                      }`}
                    >
                      <button
                        onClick={() => copyMessage(m.content)}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-surfaceHover w-full text-left whitespace-nowrap"
                      >
                        <Copy size={12} /> Copiar mensagem
                      </button>
                    </div>
                  )}
                  <div
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      failed ? "text-red-400" : "text-muted"
                    } ${m.direction === "OUTBOUND" ? "justify-end" : ""}`}
                  >
                    {failed && <AlertCircle size={12} />}
                    {new Date(m.createdAt).toLocaleTimeString("pt-BR")} · {STATUS_LABEL[m.status] ?? m.status}
                    {failed && (
                      <button
                        onClick={() => resend(m.content)}
                        className="ml-1 flex items-center gap-1 underline hover:text-red-300"
                        title="A instância provavelmente estava desconectada no momento do envio. Verifique em Meus Números e tente de novo."
                      >
                        <RotateCw size={11} /> tentar de novo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <p className="text-sm text-muted text-center mt-8">Nenhuma mensagem ainda.</p>}
          </div>

          <form onSubmit={send} className="p-3 border-t border-border flex items-center gap-1">
            <ComposerIconButton icon={Paperclip} title="Anexar arquivo" />
            <ComposerIconButton icon={ImageIcon} title="Enviar imagem" />
            <ComposerIconButton icon={DollarSign} title="Cobrar / enviar PIX" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem (atendimento manual)..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary mx-1"
            />
            <ComposerIconButton icon={Smile} title="Emoji" />
            <ComposerIconButton icon={TagIcon} title="Etiquetar" />
            <ComposerIconButton icon={Mic} title="Gravar áudio" />
            <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 ml-1">
              <Send size={14} /> Enviar
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-sm">Selecione uma conversa</div>
      )}

      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onCreated={async (conversation) => {
            setShowNewConversation(false);
            const data = await load();
            const fresh = data.find((c) => c.id === conversation.id) ?? conversation;
            setActiveTab(fresh.ticketStatus);
            await openConversation(fresh);
          }}
        />
      )}
    </div>
  );
}

// Modal do botão "+" (Nova conversa, seção 45): escolhe em qual número
// (instância) a conversa vai começar e informa o contato - se o telefone já
// existir na base, reaproveita o contato/consentimento existente em vez de
// tentar criar um duplicado (POST /contacts responde 409 nesse caso).
function NewConversationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Instance[]>("/instances").then((list) => {
      setInstances(list);
      if (list[0]) setInstanceId(list[0].id);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!instanceId || !phone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let contactId: string;
      try {
        const contact = await api<{ id: string }>("/contacts", {
          method: "POST",
          body: { name: name.trim() || phone.trim(), phone: phone.trim(), consentSource: "MANUAL" },
        });
        contactId = contact.id;
      } catch {
        // Contato já existe (telefone duplicado) - reaproveita em vez de bloquear.
        const existing = await api<{ id: string; phone: string }[]>("/contacts");
        const match = existing.find((c) => c.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
        if (!match) throw new Error("Não foi possível localizar ou criar este contato.");
        contactId = match.id;
      }
      const conversation = await api<Conversation>("/conversations", { method: "POST", body: { instanceId, contactId } });
      onCreated(conversation);
    } catch (err: any) {
      setError(err.message ?? "Erro ao iniciar conversa");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Nova conversa</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Número (instância)</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {instances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.deviceLabel || i.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Nome do contato</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !instances.length}
            className="w-full bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Criando..." : "Iniciar conversa"}
          </button>
        </form>
      </div>
    </div>
  );
}
