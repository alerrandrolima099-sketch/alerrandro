"use client";

import { useEffect, useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Tenant = { id: string; name: string; status: string; createdAt: string; _count: { instances: number; users: number } };

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setTenants(await api<Tenant[]>("/admin/tenants"));
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
      await api("/admin/tenants", { method: "POST", body: { name } });
      setName("");
      setShowCreate(false);
      await load();
      showToast("Cliente criado.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(`/admin/tenants/${id}/status`, { method: "POST", body: { status } });
      await load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  const columns: Column<Tenant>[] = [
    { key: "name", header: "Cliente", render: (t) => t.name },
    { key: "instances", header: "Números", hideBelow: "md", render: (t) => t._count.instances },
    { key: "users", header: "Usuários", hideBelow: "md", render: (t) => t._count.users },
    { key: "status", header: "Status", render: (t) => <Badge status={t.status} /> },
    {
      key: "actions",
      header: "Ações",
      render: (t) =>
        t.status !== "BLOCKED" ? (
          <button onClick={() => setStatus(t.id, "BLOCKED")} className="text-xs bg-danger/15 text-danger rounded-lg px-3 py-1.5">
            Bloquear
          </button>
        ) : (
          <button onClick={() => setStatus(t.id, "ACTIVE")} className="text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5">
            Reativar
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Gerencie os clientes (tenants) da plataforma — sem cobrança nesta versão."
        actions={
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">
            <Plus size={16} /> Novo cliente
          </button>
        }
      />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo cliente">
        <form onSubmit={create} className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do novo cliente"
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

      <Card>
        <CardBody className="p-0">
          {!tenants ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : tenants.length === 0 ? (
            <EmptyState icon={Building2} title="Nenhum cliente cadastrado" description="Crie o primeiro cliente da plataforma." />
          ) : (
            <ResponsiveTable columns={columns} rows={tenants} emptyMessage="Nenhum cliente cadastrado." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
