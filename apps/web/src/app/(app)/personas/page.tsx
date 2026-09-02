"use client";

import { useEffect, useState } from "react";
import { Bot, Plus, Trash2, Pencil, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";

// Perfis de Conversa (seção 38): persona de IA reutilizável entre
// instâncias. Antes disso, cada instância só tinha um campo de texto livre
// (aiSystemPrompt) na página Meus Números - continua existindo e tem
// prioridade quando preenchido; um Perfil é a alternativa reutilizável.

type Persona = {
  id: string;
  name: string;
  systemPrompt: string;
  createdAt: string;
  _count: { instances: number };
};

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setPersonas(await api<Persona[]>("/personas"));
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditingId(null);
    setName("");
    setSystemPrompt("");
    setShowForm(true);
  }

  function startEdit(p: Persona) {
    setEditingId(p.id);
    setName(p.name);
    setSystemPrompt(p.systemPrompt);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await api(`/personas/${editingId}`, { method: "PATCH", body: { name, systemPrompt } });
      } else {
        await api("/personas", { method: "POST", body: { name, systemPrompt } });
      }
      setShowForm(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este perfil? Instâncias que o usam voltam a usar o prompt padrão.")) return;
    await api(`/personas/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Perfis de Conversa</h1>
          <p className="text-muted max-w-2xl">
            Personas reutilizáveis para a IA - defina o tom uma vez e associe a quantas instâncias quiser em{" "}
            <a href="/instances" className="text-primary hover:underline">
              Meus Números
            </a>
            . Um texto livre configurado direto numa instância continua tendo prioridade sobre o perfil.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm whitespace-nowrap"
        >
          <Plus size={16} /> Novo perfil
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-surface border border-border rounded-xl p-4 mb-6 space-y-3">
          <div>
            <label className="text-sm text-muted block mb-1.5">Nome do perfil</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Atendimento casual, Suporte técnico..."
              className="w-full max-w-md bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">Instruções da IA (system prompt)</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              required
              rows={4}
              placeholder="Ex: Você é atendente da Loja X, responda de forma curta e cordial..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {editingId ? "Salvar alterações" : "Criar perfil"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted text-sm px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {personas === null ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 bg-surface border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : personas.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Nenhum perfil de conversa criado ainda"
          description="Crie um perfil com o tom que a IA deve usar e associe a uma ou mais instâncias."
          action={
            <button
              onClick={startCreate}
              className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium mx-auto"
            >
              <Plus size={16} /> Novo perfil
            </button>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {personas.map((p) => (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot size={16} className="text-primary shrink-0" />
                  <h3 className="font-medium truncate">{p.name}</h3>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted shrink-0">
                  <Smartphone size={12} /> {p._count.instances}
                </span>
              </div>
              <p className="text-xs text-muted line-clamp-3 mb-4">{p.systemPrompt}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5"
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="flex items-center gap-1.5 text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5"
                >
                  <Trash2 size={12} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
