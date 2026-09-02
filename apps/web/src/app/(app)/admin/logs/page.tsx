"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { SkeletonRows } from "@/components/ui/Skeleton";

type Log = { id: string; action: string; resource: string; createdAt: string; ip: string | null };

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[] | null>(null);

  useEffect(() => {
    api<{ data: Log[] }>("/logs").then((r) => setLogs(r.data));
  }, []);

  const columns: Column<Log>[] = [
    { key: "action", header: "Ação", render: (l) => l.action },
    { key: "resource", header: "Recurso", hideBelow: "md", render: (l) => l.resource },
    { key: "date", header: "Data", render: (l) => new Date(l.createdAt).toLocaleString("pt-BR") },
  ];

  return (
    <div>
      <PageHeader title="Logs (Admin)" description="Ações administrativas e eventos globais." />
      <Card>
        <CardBody className="p-0">
          {!logs ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : (
            <ResponsiveTable columns={columns} rows={logs} emptyMessage="Nenhum log registrado." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
