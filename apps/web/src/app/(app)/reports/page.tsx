"use client";

import { useEffect, useState } from "react";
import { BarChart3, Send, Inbox, UserCheck, Flame } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import clsx from "clsx";

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

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 14, label: "14 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export default function ReportsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[] | null>(null);
  const [days, setDays] = useState(14);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/dashboard/summary").then(setSummary).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    setSeries(null);
    api<TimeseriesPoint[]>(`/dashboard/messages-timeseries?days=${days}`)
      .then(setSeries)
      .catch((e) => setError(e.message));
  }, [days]);

  const acceptanceRate =
    summary && summary.invitesSent > 0 ? Math.round((summary.invitesAccepted / summary.invitesSent) * 100) : null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Indicadores agregados de aquecimento, mensageria e convites."
        actions={
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                className={clsx(
                  "text-xs px-3 py-1.5 rounded-md transition-colors",
                  days === r.days ? "bg-primary text-black font-medium" : "text-muted hover:text-white"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Números aquecendo" value={summary?.connectedInstances ?? "—"} icon={Flame} variant="fire" />
        <StatCard label="Mensagens enviadas" value={summary?.messagesProcessed ?? "—"} icon={Send} variant="primary" />
        <StatCard label="Mensagens na fila" value={summary?.messagesPending ?? "—"} icon={Inbox} variant="warning" />
        <StatCard
          label="Taxa de aceite de convites"
          value={acceptanceRate !== null ? `${acceptanceRate}%` : "—"}
          icon={UserCheck}
          variant="info"
          hint={summary ? `${summary.invitesAccepted} de ${summary.invitesSent} convites` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 size={16} className="text-muted" />
            Mensagens por dia
          </CardTitle>
          <span className="text-xs text-muted">Período: últimos {days} dias</span>
        </CardHeader>
        <CardBody>
          {!series ? (
            <div className="h-72 flex items-center justify-center text-muted text-sm">Carregando...</div>
          ) : series.length === 0 ? (
            <EmptyState icon={Send} title="Sem dados no período" description="Nenhuma mensagem foi registrada na janela de tempo selecionada." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
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
                  <Bar dataKey="count" name="Mensagens" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
