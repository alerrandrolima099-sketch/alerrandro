"use client";

import { useEffect, useState } from "react";
import { Plus, Wifi, WifiOff, Trash2, Smartphone, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

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
  const [instances, setInstances] = useState<Instance[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setInstances(await api<Instance[]>("/instances"));
  }

  useEffect(() => {
    load().catch((e) => showToast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/instances", { method: "POST", body: { name } });
      setName("");
      setShowCreate(false);
      await load();
      showToast("Número cadastrado com sucesso.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function connect(id: string) {
    setBusy(id);
    try {
      await api(`/instances/${id}/connect`, { method: "POST" });
      await load();
      showToast("Iniciando conexão do número.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    setBusy(id);
    try {
      await api(`/instances/${id}/disconnect`, { method: "POST" });
      await load();
      showToast("Número desconectado.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir este número? Essa ação não pode ser desfeita.")) return;
    try {
      await api(`/instances/${id}`, { method: "DELETE" });
      await load();
      showToast("Número excluído.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Meus Números"
        description="Gerencie as conexões de WhatsApp Business usadas para aquecimento e automação."
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm"
          >
            <Plus size={16} /> Novo número
          </button>
        }
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Cadastrar novo número">
        <form onSubmit={createInstance} className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1.5">Nome do número</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="Ex: Aquecimento Comercial 01"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
              Cancelar
            </button>
            <button disabled={creating} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {creating ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {!instances ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : instances.length === 0 ? (
        <Card>
          <EmptyState
            icon={Smartphone}
            title="Nenhum número cadastrado"
            description="Cadastre seu primeiro número de WhatsApp para começar o processo de aquecimento."
            action={
              <button onClick={() => setShowCreate(true)} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">
                Cadastrar número
              </button>
            }
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <Card key={inst.id}>
              <CardBody>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <Smartphone size={16} />
                    </div>
                    <h3 className="font-medium truncate">{inst.name}</h3>
                  </div>
                  <Badge status={inst.status} />
                </div>
                <p className="text-sm text-muted mb-1">Número: {inst.phoneNumber ?? "—"}</p>
                <p className="text-sm text-muted mb-1">Provedor: {inst.provider}</p>
                {inst.lastError && <p className="text-sm text-danger mb-1">Erro: {inst.lastError}</p>}
                <p className="text-xs text-muted mb-4 flex items-center gap-1">
                  <Clock size={12} />
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
                    className="flex items-center gap-1.5 text-xs bg-danger/15 text-danger rounded-lg px-3 py-1.5"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
