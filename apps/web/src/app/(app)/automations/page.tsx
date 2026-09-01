"use client";

import { useEffect, useState } from "react";
import { Plus, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

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
        Fluxos de atendimento automatizado. Cada automação é um grafo de nodes (START, SEND_MESSAGE, WAIT,
        WAIT_FOR_REPLY, CONDITION, TAG_CONTACT, REMOVE_TAG, TRANSFER, SEND_INVITE, END).
      </p>

      <form onSubmit={create} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da nova automação"
          className="flex-1 max-w-sm bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Criar
        </button>
      </form>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {automations.map((a) => (
          <div key={a.id} className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Workflow size={16} className="text-primary" />
                <h3 className="font-medium">{a.name}</h3>
              </div>
              <Badge status={a.status} />
            </div>
            <p className="text-sm text-muted mb-4">{a.nodes.length} node(s) configurado(s)</p>
            <div className="flex gap-2 flex-wrap">
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
        {automations.length === 0 && <p className="text-muted text-sm col-span-full">Nenhuma automação criada ainda.</p>}
      </div>
    </div>
  );
}
