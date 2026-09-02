"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";

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
  const [senders, setSenders] = useState<Sender[] | null>(null);

  useEffect(() => {
    api<Sender[]>("/admin/senders").then(setSenders);
  }, []);

  const columns: Column<Sender>[] = [
    { key: "name", header: "Nome", render: (s) => s.name },
    { key: "phone", header: "Telefone", render: (s) => s.phoneNumber },
    { key: "tenant", header: "Cliente", hideBelow: "md", render: (s) => s.instance.tenant.name },
    { key: "status", header: "Status", render: (s) => <Badge status={s.status} /> },
    {
      key: "lastUsed",
      header: "Última utilização",
      hideBelow: "lg",
      render: (s) => (s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString("pt-BR") : "—"),
    },
  ];

  return (
    <div>
      <PageHeader title="Pool de Números" description="Números de atendimento configurados globalmente (Message Sender Pool)." />

      <Card>
        <CardBody className="p-0">
          {!senders ? (
            <div className="p-5">
              <SkeletonRows rows={5} />
            </div>
          ) : senders.length === 0 ? (
            <EmptyState icon={Smartphone} title="Nenhum número configurado" description="Nenhum número foi adicionado ao pool ainda." />
          ) : (
            <ResponsiveTable columns={columns} rows={senders} emptyMessage="Nenhum número configurado." />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
