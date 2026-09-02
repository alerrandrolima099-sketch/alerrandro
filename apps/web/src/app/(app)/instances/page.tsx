"use client";

import { useEffect, useState } from "react";
import { Plus, Wifi, WifiOff, Trash2, Pause } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Instance = {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
  provider: string;
  lastError: string | null;
  lastActivityAt: string | null;
  createdAt: string;
};

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setInstances(await api<Instance[]>("/instances"));
  }

  useEffect(() => {
    load();
  }, []);

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    await api("/instances", { method: "POST", body: { name } });
    setName("");
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
        <form onSubmit={createInstance} className="bg-surface border border-border rounded-xl p-4 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm text-muted block mb-1.5">Nome da instância</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Ex: Atendimento Comercial"
            />
          </div>
          <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Criar</button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
            Cancelar
          </button>
        </form>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {instances.map((inst) => (
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

            <div className="flex gap-2">
              {inst.status !== "CONNECTED" ? (
                <button
                  disabled={busy === inst.id}
                  onClick={() => connect(inst.id)}
                  className="flex items-center gap-1.5 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                >
                  <Wifi size={14} /> Conectar
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
        ))}

        {instances.length === 0 && (
          <p className="text-muted text-sm col-span-full">Nenhuma instância cadastrada ainda. Clique em "Nova instância" para começar.</p>
        )}
      </div>
    </div>
  );
}
