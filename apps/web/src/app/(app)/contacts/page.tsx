"use client";

import { useEffect, useState } from "react";
import { Plus, LogOut, Download, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  tags: string[];
  lastInteraction: string | null;
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  async function load() {
    setContacts(await api<Contact[]>("/contacts"));
  }

  useEffect(() => {
    load();
  }, []);

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    await api("/contacts", { method: "POST", body: { ...form, consentSource: "MANUAL" } });
    setForm({ name: "", phone: "", email: "" });
    setShowCreate(false);
    await load();
  }

  async function optOut(id: string) {
    if (!confirm("Confirmar remoção deste contato (opt-out)? As automações serão interrompidas.")) return;
    await api(`/contacts/${id}/opt-out`, { method: "POST" });
    await load();
  }

  async function exportData(id: string) {
    const data = await api(`/contacts/${id}/export`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contato-${id}.json`;
    a.click();
  }

  async function deleteData(id: string) {
    if (!confirm("Excluir PERMANENTEMENTE os dados deste contato (LGPD)?")) return;
    await api(`/contacts/${id}/data`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Contatos</h1>
          <p className="text-muted">Contatos que autorizaram o recebimento de mensagens.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-black font-medium rounded-lg px-4 py-2 text-sm"
        >
          <Plus size={16} /> Novo contato
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createContact} className="bg-surface border border-border rounded-xl p-4 mb-6 grid md:grid-cols-4 gap-3 items-end">
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
          <div className="flex gap-2">
            <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Salvar</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted text-sm px-3 py-2">Cancelar</button>
          </div>
        </form>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Nome</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Telefone</th>
              <th className="px-4 py-3 font-normal hidden lg:table-cell">Tags</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{c.phone}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted">{c.tags.join(", ") || "—"}</td>
                <td className="px-4 py-3"><Badge status={c.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button title="Exportar dados (LGPD)" onClick={() => exportData(c.id)} className="p-1.5 rounded-lg bg-surfaceHover hover:bg-border">
                      <Download size={14} />
                    </button>
                    {c.status === "ACTIVE" && (
                      <button title="Remover meu contato (opt-out)" onClick={() => optOut(c.id)} className="p-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25">
                        <LogOut size={14} />
                      </button>
                    )}
                    <button title="Excluir dados (LGPD)" onClick={() => deleteData(c.id)} className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">Nenhum contato cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
