"use client";

import { useEffect, useState } from "react";
import { Flame, Clock, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { RequiresBackendBadge, RequiresBackendNotice } from "@/components/ui/RequiresBackend";

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
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    api<Session[]>("/sessions").then(setSessions);
  }, []);

  const columns: Column<Session>[] = [
    { key: "contact", header: "Contato", render: (s) => s.contact.name },
    { key: "sender", header: "Número usado", hideBelow: "md", render: (s) => s.sender?.phoneNumber ?? "—" },
    { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
    {
      key: "duration",
      header: "Duração",
      render: (s) => (s.status === "ACTIVE" && s.startedAt ? <ElapsedTimer startedAt={s.startedAt} /> : "—"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Aquecimento"
        description="Atividades de aquecimento em andamento, vinculadas ao pool de números."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Atividades</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {!sessions ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : (
            <ResponsiveTable columns={columns} rows={sessions} emptyMessage="Nenhuma atividade de aquecimento registrada." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 size={16} className="text-muted" />
            Configuração do aquecimento
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <RequiresBackendNotice title="Configuração avançada em breve">
            Os campos abaixo representam a configuração planejada para estratégias de aquecimento
            (período, limites e horários). Eles ainda não são persistidos porque o backend atual não
            possui um modelo de configuração de aquecimento — nada aqui é salvo ou aplicado até que esse
            suporte seja implementado no servidor.
          </RequiresBackendNotice>

          <div className="grid md:grid-cols-2 gap-5 opacity-60">
            <FakeField label="Período de aquecimento (dias)" placeholder="Ex: 30 dias" />
            <FakeField label="Intervalo entre mensagens" placeholder="Ex: 3 a 8 minutos" />
            <FakeField label="Limite de mensagens por dia" placeholder="Ex: 40 mensagens" />
            <FakeField label="Horário de funcionamento" placeholder="Ex: 08:00 às 20:00" />
            <FakeSelect label="Dias ativos" options={["Todos os dias", "Somente dias úteis", "Personalizado"]} />
            <FakeSelect label="Estratégia de conversa" options={["Casual", "Profissional", "Amigável", "Personalizada"]} />
            <FakeSelect label="Intensidade" options={["Suave", "Moderada", "Agressiva"]} />
            <FakeField label="Pausas automáticas" placeholder="Ex: pausar 10min a cada 20 mensagens" />
          </div>

          <button disabled className="bg-surfaceHover text-muted rounded-lg px-4 py-2 text-sm font-medium cursor-not-allowed flex items-center gap-2 w-fit">
            <Flame size={14} /> Salvar configuração (requer backend)
          </button>
        </CardBody>
      </Card>
    </div>
  );
}

function FakeField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-sm text-muted flex items-center gap-2 mb-1.5">
        {label} <RequiresBackendBadge />
      </label>
      <input disabled placeholder={placeholder} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
    </div>
  );
}

function FakeSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="text-sm text-muted flex items-center gap-2 mb-1.5">
        {label} <RequiresBackendBadge />
      </label>
      <select disabled className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
