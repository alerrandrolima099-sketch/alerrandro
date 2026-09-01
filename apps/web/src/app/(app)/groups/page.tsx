"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";

type Group = { id: string; name: string; description: string | null; inviteLink: string; category: string | null };

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState({ name: "", description: "", inviteLink: "", category: "" });
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setGroups(await api<Group[]>("/groups"));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await api("/groups", { method: "POST", body: form });
    setForm({ name: "", description: "", inviteLink: "", category: "" });
    setShowCreate(false);
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Grupos / Comunidades</h1>
          <p className="text-muted">
            Convites são enviados apenas para contatos que aceitaram recebê-los, através do link oficial.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">
          <Plus size={16} /> Novo grupo
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-surface border border-border rounded-xl p-4 mb-6 grid md:grid-cols-2 gap-3">
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input required placeholder="Link de convite oficial (https://...)" value={form.inviteLink} onChange={(e) => setForm({ ...form, inviteLink: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background border border-border rounded-lg px-3 py-2 text-sm md:col-span-2" />
          <div className="flex gap-2 md:col-span-2">
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Salvar</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((g) => (
          <div key={g.id} className="bg-surface border border-border rounded-xl p-5">
            <h3 className="font-medium mb-1">{g.name}</h3>
            {g.category && <p className="text-xs text-muted mb-2">{g.category}</p>}
            <p className="text-sm text-muted mb-2">{g.description}</p>
            <a href={g.inviteLink} target="_blank" className="text-xs text-primary hover:underline break-all">{g.inviteLink}</a>
          </div>
        ))}
        {groups.length === 0 && <p className="text-muted text-sm col-span-full">Nenhum grupo cadastrado.</p>}
      </div>
    </div>
  );
}
