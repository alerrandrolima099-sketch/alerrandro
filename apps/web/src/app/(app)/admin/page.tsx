"use client";

import { useEffect, useState } from "react";
import { Building2, Smartphone, Wifi, Clock, Send } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";

type Metrics = { tenants: number; instances: number; connectedInstances: number; activeSessions: number; messagesToday: number };

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api<Metrics>("/admin/metrics").then(setMetrics);
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard Admin" description="Visão global da plataforma." />

      {!metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Clientes" value={metrics.tenants} icon={Building2} variant="primary" />
          <StatCard label="Números totais" value={metrics.instances} icon={Smartphone} variant="primary" />
          <StatCard label="Números conectados" value={metrics.connectedInstances} icon={Wifi} variant="success" />
          <StatCard label="Atividades ativas" value={metrics.activeSessions} icon={Clock} variant="warning" />
          <StatCard label="Mensagens hoje" value={metrics.messagesToday} icon={Send} variant="info" />
        </div>
      )}
    </div>
  );
}
