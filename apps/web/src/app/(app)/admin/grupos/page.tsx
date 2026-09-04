"use client";

import { Fragment, useEffect, useState } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

// Catálogo global de grupos (seção 40): grupos cadastrados aqui pelo admin
// aparecem automaticamente na tela "Grupos" de TODOS os clientes da
// plataforma (GET /groups já traz o catálogo global + os grupos privados
// de cada tenant, ver groups.service.ts list()). Só o admin pode criar,
// editar ou desativar um grupo do catálogo - os clientes só usam (oferecer
// convite, "Entrar com todos os números").
type AdminGroup = {
  id: string;
  name: string;
  description: string | null;
  inviteLink: string;
  category: string | null;
  isActive: boolean;
  createdAt: string;
};

type GroupForm = { name: string; description: string; inviteLink: string; category: string };

const EMPTY_FORM: GroupForm = { name: "", description: "", inviteLink: "", category: "" };

export default function AdminGroupsPage() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<GroupForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  async function load() {
    setGroups(await api<AdminGroup[]>("/admin/groups"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/groups", { method: "POST", body: form });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(g: AdminGroup) {
    setEditingId(g.id);
    setEditForm({ name: g.name, description: g.description ?? "", inviteLink: g.inviteLink, category: g.category ?? "" });
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      await api(`/admin/groups/${id}`, { method: "PATCH", body: editForm });
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(g: AdminGroup) {
    await api(`/admin/groups/${g.id}`, { method: "PATCH", body: { isActive: !g.isActive } });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Grupos (catálogo global)</h1>
          <p className="text-muted max-w-2xl">
            Grupos cadastrados aqui aparecem automaticamente na tela "Grupos" de todos os clientes da
            plataforma, que podem usá-los para fazer seus próprios números entrarem - sem precisar
            cadastrar o mesmo grupo em cada conta. Os grupos privados que cada cliente cria por conta
            própria continuam separados e não aparecem nesta lista.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          <Plus size={16} /> Novo grupo
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-surface border border-border rounded-xl p-4 mb-6 grid md:grid-cols-2 gap-3">
          <input
            required
            placeholder="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            placeholder="Categoria"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Link de convite oficial (https://chat.whatsapp.com/...)"
            value={form.inviteLink}
            onChange={(e) => setForm({ ...form, inviteLink: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2"
          />
          <div className="flex gap-2 md:col-span-2">
            <button disabled={busy} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              Salvar
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Grupo</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Categoria</th>
              <th className="px-4 py-3 font-normal hidden lg:table-cell">Link</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Ações</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g: AdminGroup) => (
              <Fragment key={g.id}>
                <tr className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{g.name}</div>
                    {g.description && <div className="text-xs text-muted line-clamp-1 max-w-xs">{g.description}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted">{g.category ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <a href={g.inviteLink} target="_blank" className="text-xs text-primary hover:underline break-all">
                      {g.inviteLink}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={g.isActive ? "ACTIVE" : "ARCHIVED"} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => startEdit(g)}
                        className="flex items-center gap-1 text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      {g.isActive ? (
                        <button onClick={() => toggleActive(g)} className="text-xs bg-red-500/15 text-red-400 rounded-lg px-3 py-1.5">
                          Desativar
                        </button>
                      ) : (
                        <button onClick={() => toggleActive(g)} className="text-xs bg-primary/15 text-primary rounded-lg px-3 py-1.5">
                          Reativar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === g.id && (
                  <tr className="border-b border-border last:border-0 bg-background/40">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <input
                          placeholder="Nome"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="Categoria"
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="Link de convite"
                          value={editForm.inviteLink}
                          onChange={(e) => setEditForm({ ...editForm, inviteLink: e.target.value })}
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2"
                        />
                        <textarea
                          placeholder="Descrição"
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2"
                        />
                        <div className="flex gap-2 md:col-span-2">
                          <button
                            disabled={busy}
                            onClick={() => saveEdit(g.id)}
                            className="flex items-center gap-1.5 bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                          >
                            <Check size={14} /> Salvar
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1.5 text-muted text-sm px-3 py-2"
                          >
                            <X size={14} /> Cancelar
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted text-sm">
                  Nenhum grupo no catálogo ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
