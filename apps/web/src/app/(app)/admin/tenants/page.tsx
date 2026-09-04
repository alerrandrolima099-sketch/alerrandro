"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Tenant = { id: string; name: string; status: string; createdAt: string; _count: { instances: number; users: number } };

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [name, setName] = useState("");

  async function load() {
    setTenants(await api<Tenant[]>("/admin/tenants"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api("/admin/tenants", { method: "POST", body: { name } });
    setName("");
    await load();
  }

  async function setStatus(id: string, status: string) {
    await api(`/admin/tenants/${id}/status`, { method: "POST", body: { status } });
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Clientes</h1>
      <p className="text-muted mb-6">Gerencie os clientes (tenants) da plataforma - sem cobrança nesta versão.</p>

      <form onSubmit={create} className="flex gap-2 mb-6">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do novo cliente" className="flex-1 max-w-sm bg-surface border border-border rounded-lg px-3 py-2 text-sm" />
        <button className="flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Criar
        </button>
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Cliente</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Instâncias</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Usuários</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Ações</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{t.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{t._count.instances}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{t._count.users}</td>
                <td className="px-4 py-3"><Badge status={t.status} /></td>
                <td className="px-4 py-3">
                  {t.status !== "BLOCKED" ? (
                    <button onClick={() => setStatus(t.id, "BLOCKED")} className="text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5">Bloquear</button>
                  ) : (
                    <button onClick={() => setStatus(t.id, "ACTIVE")} className="text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5">Reativar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
