"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { RequiresBackendNotice } from "@/components/ui/RequiresBackend";

type Session = {
  id: string;
  status: string;
  currentStep: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  contact: { name: string; phone: string };
  sender: { name: string; phoneNumber: string } | null;
};

function dayLabel(date: Date) {
  const today = new Date();
  const isSameDay = date.toDateString() === today.toDateString();
  if (isSameDay) return "Hoje";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function AgendaPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);

  useEffect(() => {
    api<Session[]>("/sessions").then(setSessions);
  }, []);

  const queue = (sessions ?? []).filter((s) => s.status === "WAITING" || s.status === "ACTIVE");

  const groups = new Map<string, Session[]>();
  for (const s of queue) {
    const ref = s.startedAt ?? s.createdAt;
    const key = new Date(ref).toDateString();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const orderedKeys = Array.from(groups.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <div>
      <PageHeader
        title="Agenda"
        description="Fila de atividades de aquecimento aguardando ou em andamento, agrupadas por dia."
      />

      <RequiresBackendNotice title="Agendamento por horário exato indisponível">
        O modelo de dados atual não guarda um horário futuro específico para cada atividade — apenas o
        momento em que ela foi criada, iniciada e finalizada. Por isso, esta agenda mostra uma fila
        ordenada cronologicamente, e não um calendário com horários marcados. Um agendamento com hora
        exata exigiria um campo novo no backend.
      </RequiresBackendNotice>

      <div className="mt-6">
        {!sessions ? (
          <Card>
            <CardBody>
              <SkeletonRows rows={5} />
            </CardBody>
          </Card>
        ) : queue.length === 0 ? (
          <Card>
            <EmptyState icon={CalendarClock} title="Fila vazia" description="Não há atividades aguardando ou em andamento no momento." />
          </Card>
        ) : (
          <div className="space-y-6">
            {orderedKeys.map((key) => {
              const items = groups.get(key)!;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle>{dayLabel(new Date(key))}</CardTitle>
                    <span className="text-xs text-muted">{items.length} atividade(s)</span>
                  </CardHeader>
                  <CardBody className="p-0">
                    <ul className="divide-y divide-border">
                      {items.map((s) => (
                        <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-3">
                            <Clock size={14} className="text-muted shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{s.contact.name}</p>
                              <p className="text-xs text-muted truncate">
                                {s.sender?.phoneNumber ?? "Número não atribuído"}
                                {s.currentStep ? ` · ${s.currentStep}` : ""}
                              </p>
                            </div>
                          </div>
                          <Badge status={s.status} />
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
