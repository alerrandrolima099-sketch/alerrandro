"use client";

import { useEffect, useState } from "react";
import { Smartphone, Wifi, WifiOff, AlertTriangle, Clock, CheckCircle2, Send, Inbox, UserCheck, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

type Summary = {
  totalInstances: number;
  connectedInstances: number;
  disconnectedInstances: number;
  errorInstances: number;
  activeSessions: number;
  completedSessions: number;
  messagesProcessed: number;
  messagesPending: number;
  invitesSent: number;
  invitesAccepted: number;
  activeContacts: number;
  activeAutomations: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/dashboard/summary").then(setSummary).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
      <p className="text-muted mb-6">Visão geral das suas instâncias e automações.</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!summary ? (
        <p className="text-muted text-sm">Carregando indicadores...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total de instâncias" value={summary.totalInstances} icon={Smartphone} />
          <StatCard label="Instâncias conectadas" value={summary.connectedInstances} icon={Wifi} accent="bg-green-500/15 text-green-400" />
          <StatCard label="Instâncias desconectadas" value={summary.disconnectedInstances} icon={WifiOff} accent="bg-gray-500/15 text-gray-400" />
          <StatCard label="Instâncias com erro" value={summary.errorInstances} icon={AlertTriangle} accent="bg-red-500/15 text-red-400" />
          <StatCard label="Sessões em andamento" value={summary.activeSessions} icon={Clock} accent="bg-yellow-500/15 text-yellow-400" />
          <StatCard label="Sessões concluídas" value={summary.completedSessions} icon={CheckCircle2} />
          <StatCard label="Mensagens processadas" value={summary.messagesProcessed} icon={Send} />
          <StatCard label="Mensagens pendentes" value={summary.messagesPending} icon={Inbox} accent="bg-yellow-500/15 text-yellow-400" />
          <StatCard label="Convites enviados" value={summary.invitesSent} icon={UserCheck} />
          <StatCard label="Convites aceitos" value={summary.invitesAccepted} icon={UserCheck} accent="bg-green-500/15 text-green-400" />
          <StatCard label="Contatos ativos" value={summary.activeContacts} icon={UserCheck} />
          <StatCard label="Automações ativas" value={summary.activeAutomations} icon={Workflow} />
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-6">
        <h2 className="font-medium mb-2">Tempo real</h2>
        <p className="text-sm text-muted">
          Os indicadores acima são atualizados via WebSocket sempre que uma instância muda de status, uma
          sessão avança de etapa ou uma automação é concluída. Conecte-se a uma instância na página{" "}
          <a href="/instances" className="text-primary hover:underline">
            Instâncias
          </a>{" "}
          para começar.
        </p>
      </div>
    </div>
  );
}
