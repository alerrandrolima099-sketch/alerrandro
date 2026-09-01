"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Sender = {
  id: string;
  name: string;
  phoneNumber: string;
  status: string;
  isActive: boolean;
  lastUsedAt: string | null;
  instance: { name: string; tenant: { name: string } };
};

export default function AdminSendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);

  useEffect(() => {
    api<Sender[]>("/admin/senders").then(setSenders);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Pool de Números</h1>
      <p className="text-muted mb-6">Números de atendimento configurados globalmente (Message Sender Pool).</p>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Nome</th>
              <th className="px-4 py-3 font-normal">Telefone</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Cliente</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal hidden lg:table-cell">Última utilização</th>
            </tr>
          </thead>
          <tbody>
            {senders.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3 text-muted">{s.phoneNumber}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{s.instance.tenant.name}</td>
                <td className="px-4 py-3"><Badge status={s.status} /></td>
                <td className="px-4 py-3 hidden lg:table-cell text-muted">
                  {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString("pt-BR") : "—"}
                </td>
              </tr>
            ))}
            {senders.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Nenhum número configurado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
