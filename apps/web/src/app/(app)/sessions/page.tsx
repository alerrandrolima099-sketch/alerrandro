"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";

type Session = {
  id: string;
  status: string;
  currentStep: string | null;
  startedAt: string | null;
  endedAt: string | null;
  contact: { name: string; phone: string };
  sender: { name: string; phoneNumber: string } | null;
};

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState("00:00:00");
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      const diff = Math.max(0, Date.now() - start);
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  return <span className="font-mono text-primary">{elapsed}</span>;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    api<Session[]>("/sessions").then(setSessions);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Sessões</h1>
      <p className="text-muted mb-6">Atendimentos em andamento, vinculados ao pool de números.</p>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-normal">Contato</th>
              <th className="px-4 py-3 font-normal hidden md:table-cell">Número usado</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">Duração</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{s.contact.name}</td>
                <td className="px-4 py-3 hidden md:table-cell text-muted">{s.sender?.phoneNumber ?? "—"}</td>
                <td className="px-4 py-3"><Badge status={s.status} /></td>
                <td className="px-4 py-3">
                  {s.status === "ACTIVE" && s.startedAt ? <ElapsedTimer startedAt={s.startedAt} /> : "—"}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Nenhuma sessão registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
