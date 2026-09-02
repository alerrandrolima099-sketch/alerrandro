"use client";

import { useEffect, useState } from "react";
import {
  Smartphone, Wifi, WifiOff, AlertTriangle, Clock, CheckCircle2, Send, Inbox, UserCheck, Workflow, Radio, Flame,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { ChartCard } from "@/components/ChartCard";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/Badge";

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

type WarmupPairLite = {
  id: string;
  instanceA: { id: string; name: string };
  instanceB: { id: string; name: string };
  enabled: boolean;
  dailyMessageTarget: number;
  sentToday: number;
  lastError: string | null;
};

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[] | null>(null);
  const [pairs, setPairs] = useState<WarmupPairLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>("/dashboard/summary").then(setSummary).catch((e) => setError(e.message));
    api<TimeseriesPoint[]>("/dashboard/messages-timeseries").then(setTimeseries).catch(() => setTimeseries([]));
    api<WarmupPairLite[]>("/warmup-pairs").then(setPairs).catch(() => setPairs([]));
  }, []);

  const chartData = (timeseries ?? []).map((p) => ({ ...p, label: formatDateLabel(p.date) }));

  return (
    <div className="animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">
          Olá, <span className="text-gradient-primary">bem-vindo de volta</span>
        </h1>
        <p className="text-muted">Visão geral do aquecimento dos seus números e das suas automações.</p>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {!summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4 h-[72px] animate-pulse" />
          ))}
        </div>
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
          <StatCard label="Automações ativas" value={summary.activeAutomations} icon={Workflow} accent="bg-accent/15 text-accent" />
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4 mb-8">
        <div className="lg:col-span-3">
          <ChartCard
            title="Mensagens por dia"
            subtitle="Últimos 14 dias, todas as instâncias"
            loading={timeseries === null}
            empty={timeseries !== null && timeseries.length === 0}
            emptyMessage="Ainda não há mensagens registradas neste período."
            height={240}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#232a3a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#8b98a9" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#8b98a9" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  contentStyle={{ background: "#171c27", border: "1px solid #232a3a", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#8b98a9" }}
                />
                <Area type="monotone" dataKey="count" name="Mensagens" stroke="#22c55e" fill="url(#msgGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={16} className="text-primary" />
              <h3 className="font-medium">Aquecimento em andamento</h3>
            </div>
            <a href="/warmup" className="text-xs text-primary hover:underline shrink-0">
              Ver tudo
            </a>
          </div>

          {pairs === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-surfaceHover rounded-lg animate-pulse" />
              ))}
            </div>
          ) : pairs.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="Nenhum aquecimento ativo"
              description="Crie um par de aquecimento para começar a esquentar dois dos seus números."
              action={
                <a href="/warmup" className="text-xs bg-primary text-black rounded-lg px-3 py-1.5 font-medium">
                  Ir para Aquecimento
                </a>
              }
            />
          ) : (
            <div className="space-y-3">
              {pairs.slice(0, 5).map((pair) => {
                const pct = Math.min(100, Math.round((pair.sentToday / Math.max(pair.dailyMessageTarget, 1)) * 100));
                return (
                  <div key={pair.id}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <p className="text-sm truncate">
                        {pair.instanceA.name} <span className="text-muted">⇄</span> {pair.instanceB.name}
                      </p>
                      <Badge status={pair.enabled ? "ACTIVE" : "PAUSED"} />
                    </div>
                    <div className="h-1.5 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {pair.sentToday}/{pair.dailyMessageTarget} mensagens hoje
                      {pair.lastError && <span className="text-red-400"> · erro recente</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden bg-surface border border-border rounded-xl p-6">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Radio size={18} />
          </div>
          <div>
            <h2 className="font-medium mb-1">Tempo real</h2>
            <p className="text-sm text-muted">
              Os indicadores acima são atualizados via WebSocket sempre que uma instância muda de status, uma
              sessão avança de etapa ou uma automação é concluída. Conecte-se a uma instância na página{" "}
              <a href="/instances" className="text-primary hover:underline font-medium">
                Meus Números
              </a>{" "}
              para começar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
