"use client";

import { useEffect, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Group = { id: string; name: string; description: string | null; inviteLink: string; category: string | null };

/** Painel de grupos/comunidades reutilizado como aba dentro de /automations e na rota /groups. */
export function GroupsPanel() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [form, setForm] = useState({ name: "", description: "", inviteLink: "", category: "" });
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setGroups(await api<Group[]>("/groups"));
  }

  useEffect(() => {
    load().catch((e) => showToast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/groups", { method: "POST", body: form });
      setForm({ name: "", description: "", inviteLink: "", category: "" });
      setShowCreate(false);
      await load();
      showToast("Grupo cadastrado.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted max-w-xl">
          Convites são enviados apenas para contatos que aceitaram recebê-los, através do link oficial.
        </p>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium shrink-0">
          <Plus size={16} /> Novo grupo
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo grupo">
        <form onSubmit={create} className="space-y-3">
          <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <input required placeholder="Link de convite oficial (https://...)" value={form.inviteLink} onChange={(e) => setForm({ ...form, inviteLink: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <textarea placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
            <button disabled={saving} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      {!groups ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title="Nenhum grupo cadastrado" description="Cadastre grupos e comunidades para enviar convites a contatos que autorizaram." />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((g) => (
            <Card key={g.id}>
              <CardBody>
                <h3 className="font-medium mb-1">{g.name}</h3>
                {g.category && <p className="text-xs text-muted mb-2">{g.category}</p>}
                <p className="text-sm text-muted mb-2">{g.description}</p>
                <a href={g.inviteLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline break-all">{g.inviteLink}</a>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
