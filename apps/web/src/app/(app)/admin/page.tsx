"use client";

import { useEffect, useState } from "react";
import { Building2, Smartphone, Wifi, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";

type Metrics = { tenants: number; instances: number; connectedInstances: number; activeSessions: number; messagesToday: number };

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    api<Metrics>("/admin/metrics").then(setMetrics);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Dashboard Admin</h1>
      <p className="text-muted mb-6">Visão global da plataforma.</p>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Clientes" value={metrics.tenants} icon={Building2} />
          <StatCard label="Instâncias totais" value={metrics.instances} icon={Smartphone} />
          <StatCard label="Instâncias conectadas" value={metrics.connectedInstances} icon={Wifi} accent="bg-green-500/15 text-green-400" />
          <StatCard label="Sessões ativas" value={metrics.activeSessions} icon={Clock} accent="bg-yellow-500/15 text-yellow-400" />
          <StatCard label="Mensagens hoje" value={metrics.messagesToday} icon={Smartphone} />
        </div>
      )}
    </div>
  );
}
