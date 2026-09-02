"use client";

import { useEffect, useState } from "react";
import { Plus, LogOut, Download, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  tags: string[];
  lastInteraction: string | null;
};

/** Painel de contatos reutilizado pela página de Conversas (aba) e pela rota /contacts. */
export function ContactsPanel() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setContacts(await api<Contact[]>("/contacts"));
  }

  useEffect(() => {
    load().catch((e) => showToast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/contacts", { method: "POST", body: { ...form, consentSource: "MANUAL" } });
      setForm({ name: "", phone: "", email: "" });
      setShowCreate(false);
      await load();
      showToast("Contato adicionado.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function optOut(id: string) {
    if (!confirm("Confirmar remoção deste contato (opt-out)? As automações serão interrompidas.")) return;
    await api(`/contacts/${id}/opt-out`, { method: "POST" });
    await load();
    showToast("Contato removido (opt-out).", "success");
  }

  async function exportData(id: string) {
    const data = await api(`/contacts/${id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contato-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteData(id: string) {
    if (!confirm("Excluir PERMANENTEMENTE os dados deste contato (LGPD)?")) return;
    await api(`/contacts/${id}/data`, { method: "DELETE" });
    await load();
    showToast("Dados do contato excluídos.", "success");
  }

  const columns: Column<Contact>[] = [
    { key: "name", header: "Nome", render: (c) => c.name },
    { key: "phone", header: "Telefone", hideBelow: "md", render: (c) => c.phone },
    { key: "tags", header: "Tags", hideBelow: "lg", render: (c) => c.tags.join(", ") || "—" },
    { key: "status", header: "Status", render: (c) => <Badge status={c.status} /> },
    {
      key: "actions",
      header: "Ações",
      render: (c) => (
        <div className="flex gap-2 justify-end sm:justify-start">
          <button title="Exportar dados (LGPD)" onClick={() => exportData(c.id)} className="p-1.5 rounded-lg bg-surfaceHover hover:bg-border">
            <Download size={14} />
          </button>
          {c.status === "ACTIVE" && (
            <button title="Remover contato (opt-out)" onClick={() => optOut(c.id)} className="p-1.5 rounded-lg bg-warning/15 text-warning hover:bg-warning/25">
              <LogOut size={14} />
            </button>
          )}
          <button title="Excluir dados (LGPD)" onClick={() => deleteData(c.id)} className="p-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger/25">
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">Contatos que autorizaram o recebimento de mensagens.</p>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm shrink-0"
        >
          <Plus size={16} /> Novo contato
        </button>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo contato">
        <form onSubmit={createContact} className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1.5">Nome</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">Telefone</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+5511999999999" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">E-mail (opcional)</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
            <button disabled={saving} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </Modal>

      <Card>
        <CardBody className="p-0">
          {!contacts ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : (
            <ResponsiveTable columns={columns} rows={contacts} emptyMessage="Nenhum contato cadastrado." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
