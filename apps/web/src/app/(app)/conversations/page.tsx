"use client";

import { useEffect, useState } from "react";
import { Send, Pause, Play, MessageSquare, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Tabs } from "@/components/ui/Tabs";
import { ContactsPanel } from "@/components/panels/ContactsPanel";
import { EmptyState } from "@/components/ui/EmptyState";

type Conversation = {
  id: string;
  automationPaused: boolean;
  contact: { id: string; name: string; phone: string };
  instance: { id: string; name: string };
  messages: { content: string; createdAt: string }[];
};

type Message = { id: string; direction: "INBOUND" | "OUTBOUND"; content: string; status: string; createdAt: string };

function ConversationsPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");

  async function load() {
    const data = await api<Conversation[]>("/conversations");
    setConversations(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function openConversation(c: Conversation) {
    setSelected(c);
    setMessages(await api<Message[]>(`/conversations/${c.id}/messages`));
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    await api(`/conversations/${selected.id}/messages`, { method: "POST", body: { content: draft } });
    setDraft("");
    setMessages(await api<Message[]>(`/conversations/${selected.id}/messages`));
  }

  async function toggleAutomation() {
    if (!selected) return;
    const path = selected.automationPaused ? "resume" : "pause";
    await api(`/conversations/${selected.id}/automation/${path}`, { method: "POST" });
    await load();
    setSelected({ ...selected, automationPaused: !selected.automationPaused });
  }

  return (
    <div className="h-[calc(100vh-13rem)] md:h-[calc(100vh-12rem)] -mx-6 md:-mx-8 flex border-t border-border">
      <div className="w-full md:w-80 border-r border-border overflow-y-auto shrink-0">
        {conversations.length === 0 && (
          <div className="p-4">
            <EmptyState icon={MessageSquare} title="Nenhuma conversa ainda" description="Conversas monitoradas aparecerão aqui assim que houver troca de mensagens." />
          </div>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => openConversation(c)}
            className={`w-full text-left px-4 py-3 border-b border-border hover:bg-surfaceHover ${selected?.id === c.id ? "bg-surfaceHover" : ""}`}
          >
            <div className="font-medium text-sm">{c.contact.name}</div>
            <div className="text-xs text-muted">{c.contact.phone}</div>
            {c.messages[0] && <div className="text-xs text-muted truncate mt-1">{c.messages[0].content}</div>}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-medium">{selected.contact.name}</div>
              <div className="text-xs text-muted">{selected.instance.name}</div>
            </div>
            <button
              onClick={toggleAutomation}
              className="flex items-center gap-2 text-xs bg-surfaceHover rounded-lg px-3 py-1.5"
            >
              {selected.automationPaused ? <Play size={14} /> : <Pause size={14} />}
              {selected.automationPaused ? "Retomar automação" : "Pausar automação"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[70%] ${m.direction === "OUTBOUND" ? "ml-auto" : ""}`}>
                <div className={`rounded-xl px-3 py-2 text-sm ${m.direction === "OUTBOUND" ? "bg-primary/15 text-white" : "bg-surface border border-border"}`}>
                  {m.content}
                </div>
                <div className="text-xs text-muted mt-1">{new Date(m.createdAt).toLocaleTimeString("pt-BR")} · {m.status}</div>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="p-4 border-t border-border flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva uma mensagem (envio manual)..."
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
              <Send size={14} /> Enviar
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-muted text-sm">Selecione uma conversa</div>
      )}
    </div>
  );
}

export default function ConversationsPage() {
  const [tab, setTab] = useState("conversations");

  return (
    <div>
      <div className="mb-1">
        <h1 className="text-2xl font-semibold mb-1">Conversas</h1>
        <p className="text-muted text-sm max-w-2xl">
          Monitoramento das conversas e gerenciamento dos contatos que autorizaram o recebimento de mensagens.
        </p>
      </div>

      <Tabs
        tabs={[
          { key: "conversations", label: "Conversas", icon: <MessageSquare size={14} /> },
          { key: "contacts", label: "Contatos", icon: <Users size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "conversations" ? <ConversationsPanel /> : <ContactsPanel />}
    </div>
  );
}
