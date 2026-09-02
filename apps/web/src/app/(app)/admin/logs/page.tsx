"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Log = { id: string; action: string; resource: string; createdAt: string; ip: string | null };

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    api<{ data: Log[] }>("/logs").then((r) => setLogs(r.data));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Logs (Admin)</h1>
      <p className="text-muted mb-6">Ações administrativas e eventos globais.</p>
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Ação</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Recurso</th>
              <th className="px-4 py-3 font-normal">Data</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{l.action}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{l.resource}</td>
                <td className="px-4 py-3 text-muted">{new Date(l.createdAt).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
