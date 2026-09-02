"use client";

import { useEffect, useState } from "react";
import { Plus, Workflow, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { GroupsPanel } from "@/components/panels/GroupsPanel";
import { AutomationCanvas, AutomationNode } from "@/components/panels/AutomationCanvas";

type Automation = { id: string; name: string; status: string; nodes: AutomationNode[] };

function AutomationsPanel() {
  const [automations, setAutomations] = useState<Automation[] | null>(null);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { showToast } = useToast();

  async function load() {
    setAutomations(await api<Automation[]>("/automations"));
  }

  useEffect(() => {
    load().catch((e) => showToast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api("/automations", { method: "POST", body: { name } });
      setName("");
      setShowCreate(false);
      await load();
      showToast("Automação criada.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(`/automations/${id}/status`, { method: "POST", body: { status } });
      await load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-sm text-muted max-w-xl">
          Fluxos de atendimento automatizado. Cada automação é um grafo de nós (início, envio de mensagem,
          espera, condição, tags, transferência, convite e fim).
        </p>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium shrink-0">
          <Plus size={16} /> Nova automação
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova automação">
        <form onSubmit={create} className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da automação"
            autoFocus
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
            <button disabled={creating} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      </Modal>

      {!automations ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <EmptyState icon={Workflow} title="Nenhuma automação criada" description="Crie sua primeira automação para orquestrar o envio de mensagens durante o aquecimento." />
        </Card>
      ) : (
        <div className="space-y-4">
          {automations.map((a) => {
            const isOpen = expanded === a.id;
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <button
                      onClick={() => setExpanded(isOpen ? null : a.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      <Workflow size={16} className="text-primary shrink-0" />
                      <h3 className="font-medium">{a.name}</h3>
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge status={a.status} />
                      {a.status !== "ACTIVE" && (
                        <button onClick={() => setStatus(a.id, "ACTIVE")} className="text-xs bg-success/15 text-success rounded-lg px-3 py-1.5">
                          Ativar
                        </button>
                      )}
                      {a.status === "ACTIVE" && (
                        <button onClick={() => setStatus(a.id, "PAUSED")} className="text-xs bg-warning/15 text-warning rounded-lg px-3 py-1.5">
                          Pausar
                        </button>
                      )}
                      <button onClick={() => setStatus(a.id, "ARCHIVED")} className="text-xs bg-gray-500/15 text-gray-300 rounded-lg px-3 py-1.5">
                        Arquivar
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted mb-3">{a.nodes.length} nó(s) configurado(s)</p>
                  {a.nodes.length > 0 ? (
                    isOpen ? (
                      <AutomationCanvas nodes={a.nodes} />
                    ) : (
                      <button onClick={() => setExpanded(a.id)} className="text-xs text-primary hover:underline">
                        Ver fluxo visual
                      </button>
                    )
                  ) : (
                    <p className="text-xs text-muted">Automação ainda sem nós configurados.</p>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AutomationsPage() {
  const [tab, setTab] = useState("automations");

  return (
    <div>
      <PageHeader title="Automações" />

      <Tabs
        tabs={[
          { key: "automations", label: "Automações", icon: <Workflow size={14} /> },
          { key: "groups", label: "Grupos", icon: <UsersRound size={14} /> },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "automations" ? <AutomationsPanel /> : <GroupsPanel />}
    </div>
  );
}
