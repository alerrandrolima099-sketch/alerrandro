"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Workflow, PenLine } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";

type Automation = { id: string; name: string; status: string; nodes: { id: string; type: string }[] };

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setAutomations(await api<Automation[]>("/automations"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api("/automations", { method: "POST", body: { name } });
    setName("");
    await load();
  }

  async function setStatus(id: string, status: string) {
    await api(`/automations/${id}/status`, { method: "POST", body: { status } });
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Automações</h1>
      <p className="text-muted mb-6">
        Fluxos automatizados de conversa. Crie um fluxo aqui e monte os passos (mensagem, espera, condição, tag
        etc.) no editor visual, clicando em "Editar fluxo".
      </p>

      <form onSubmit={create} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova automação"
          className="flex-1 max-w-sm bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button className="flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Criar
        </button>
      </form>

      {automations.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title="Nenhuma automação criada ainda"
          description="Dê um nome e crie sua primeira automação para começar a montar o fluxo no editor visual."
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {automations.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Workflow size={16} className="text-primary shrink-0" />
                  <h3 className="font-medium truncate">{a.name}</h3>
                </div>
                <Badge status={a.status} />
              </div>
              <p className="text-sm text-muted mb-4">{a.nodes.length} nó(s) configurado(s)</p>
              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/automations/${a.id}`}
                  className="flex items-center gap-1.5 text-xs bg-accent/15 text-accent rounded-lg px-3 py-1.5"
                >
                  <PenLine size={12} /> Editar fluxo
                </Link>
                {a.status !== "ACTIVE" && (
                  <button onClick={() => setStatus(a.id, "ACTIVE")} className="text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5">
                    Ativar
                  </button>
                )}
                {a.status === "ACTIVE" && (
                  <button onClick={() => setStatus(a.id, "PAUSED")} className="text-xs bg-yellow-500/15 text-yellow-400 rounded-lg px-3 py-1.5">
                    Pausar
                  </button>
                )}
                <button onClick={() => setStatus(a.id, "ARCHIVED")} className="text-xs bg-gray-500/15 text-gray-300 rounded-lg px-3 py-1.5">
                  Arquivar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
