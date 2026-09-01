"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await api("/auth/change-password", { method: "POST", body: form });
      setMessage("Senha alterada com sucesso.");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-1">Configurações</h1>
      <p className="text-muted mb-6">Perfil, segurança e preferências da conta.</p>

      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="font-medium mb-4">Alterar senha</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="text-sm text-muted block mb-1.5">Senha atual</label>
            <input
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">Nova senha (mín. 8 caracteres)</label>
            <input
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {message && <p className="text-sm text-muted">{message}</p>}
          <button className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium">Salvar</button>
        </form>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="font-medium mb-2">Sobre este SaaS</h2>
        <p className="text-sm text-muted">
          Esta versão não possui sistema de cobrança ou planos de assinatura - o acesso é liberado
          integralmente. A arquitetura já está preparada para, futuramente, adicionar planos sem
          necessidade de reescrever o restante do sistema.
        </p>
      </div>
    </div>
  );
}
