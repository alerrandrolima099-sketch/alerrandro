"use client";

import { useEffect, useState } from "react";
import {
  Smartphone, Flame, PauseCircle, AlertTriangle, Send, Inbox,
  UserCheck, Workflow, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

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

type TimeseriesPoint = { date: string; count: number };

type Session = {
  id: string;
  status: string;
  currentStep: string | null;
  startedAt: string | null;
  endedAt: string | null;
  contact: { name: string; phone: string };
  sender: { name: string; phoneNumber: string } | null;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Summary>("/dashboard/summary"),
      api<TimeseriesPoint[]>("/dashboard/messages-timeseries"),
      api<Session[]>("/sessions"),
    ])
      .then(([s, t, se]) => {
        setSummary(s);
        setSeries(t);
        setSessions(se);
      })
      .catch((e) => setError(e.message));
  }, []);

  const activity = (sessions ?? [])
    .filter((s) => s.status === "ACTIVE" || s.status === "WAITING")
    .slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Central de Aquecimento"
        description="Visão geral do aquecimento dos seus números, atividade recente e volume de mensagens."
      />

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {!summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          <StatCard label="Números cadastrados" value={summary.totalInstances} icon={Smartphone} variant="primary" />
          <StatCard label="Números aquecendo" value={summary.connectedInstances} icon={Flame} variant="fire" />
          <StatCard label="Números pausados" value={summary.disconnectedInstances} icon={PauseCircle} variant="neutral" />
          <StatCard label="Números com erro" value={summary.errorInstances} icon={AlertTriangle} variant="danger" />
          <StatCard label="Atividades em andamento" value={summary.activeSessions} icon={Clock} variant="warning" />
          <StatCard label="Atividades concluídas" value={summary.completedSessions} icon={Flame} variant="success" />
          <StatCard label="Mensagens enviadas" value={summary.messagesProcessed} icon={Send} variant="primary" />
          <StatCard label="Mensagens na fila" value={summary.messagesPending} icon={Inbox} variant="warning" />
          <StatCard label="Convites enviados" value={summary.invitesSent} icon={UserCheck} variant="info" />
          <StatCard label="Convites aceitos" value={summary.invitesAccepted} icon={UserCheck} variant="success" />
          <StatCard label="Contatos ativos" value={summary.activeContacts} icon={UserCheck} variant="primary" />
          <StatCard label="Automações ativas" value={summary.activeAutomations} icon={Workflow} variant="info" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução de mensagens</CardTitle>
            <span className="text-xs text-muted">Últimos 14 dias</span>
          </CardHeader>
          <CardBody>
            {!series ? (
              <div className="h-64 flex items-center justify-center text-muted text-sm">Carregando gráfico...</div>
            ) : series.length === 0 ? (
              <EmptyState icon={Send} title="Ainda sem mensagens" description="Quando suas automações começarem a enviar mensagens, o volume diário aparecerá aqui." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#232c3a" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      stroke="#8b98a9"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis stroke="#8b98a9" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{ background: "#171f2a", border: "1px solid #232c3a", borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(d) => new Date(d).toLocaleDateString("pt-BR")}
                    />
                    <Area type="monotone" dataKey="count" name="Mensagens" stroke="#22c55e" strokeWidth={2} fill="url(#msgGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximas atividades</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {!sessions ? (
              <div className="p-5 text-sm text-muted">Carregando...</div>
            ) : activity.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Clock} title="Nenhuma atividade na fila" description="Atividades de aquecimento ativas ou aguardando aparecerão aqui." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((s) => (
                  <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.contact.name}</p>
                      <p className="text-xs text-muted truncate">{s.sender?.phoneNumber ?? "Número não atribuído"}</p>
                    </div>
                    <Badge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 mt-6">
        <h2 className="font-medium mb-2">Tempo real</h2>
        <p className="text-sm text-muted">
          Os indicadores acima refletem o estado atual do banco de dados e são atualizados via WebSocket sempre
          que um número muda de status, uma atividade de aquecimento avança de etapa ou uma automação é concluída.
          Conecte um número na página{" "}
          <a href="/instances" className="text-primary hover:underline">
            Meus Números
          </a>{" "}
          para começar a aquecer.
        </p>
      </div>
    </div>
  );
}
