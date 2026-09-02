"use client";

import { useEffect, useState } from "react";
import { Bell, Wifi, WifiOff, AlertTriangle, CheckCircle2, UserX, Info, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import clsx from "clsx";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, typeof Bell> = {
  INSTANCE_CONNECTED: Wifi,
  INSTANCE_DISCONNECTED: WifiOff,
  INSTANCE_ERROR: AlertTriangle,
  AUTOMATION_COMPLETED: CheckCircle2,
  CONTACT_OPT_OUT: UserX,
  GENERIC: Info,
};

const TYPE_COLOR: Record<string, string> = {
  INSTANCE_CONNECTED: "bg-success/15 text-success",
  INSTANCE_DISCONNECTED: "bg-gray-500/15 text-gray-400",
  INSTANCE_ERROR: "bg-danger/15 text-danger",
  AUTOMATION_COMPLETED: "bg-primary/15 text-primary",
  CONTACT_OPT_OUT: "bg-warning/15 text-warning",
  GENERIC: "bg-info/15 text-info",
};

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const { showToast } = useToast();

  async function load() {
    setNotifications(await api<Notification[]>("/notifications"));
  }

  useEffect(() => {
    load().catch((e) => showToast(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function markAllRead() {
    const unread = (notifications ?? []).filter((n) => !n.readAt);
    for (const n of unread) {
      await api(`/notifications/${n.id}/read`, { method: "POST" }).catch(() => {});
    }
    await load();
    showToast("Alertas marcados como lidos.", "success");
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.readAt).length;

  return (
    <div>
      <PageHeader
        title="Alertas"
        description="Notificações sobre números, automações e contatos."
        actions={
          unreadCount > 0 ? (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 text-xs bg-surfaceHover hover:bg-border rounded-lg px-3 py-2"
            >
              <CheckCheck size={14} /> Marcar todos como lidos ({unreadCount})
            </button>
          ) : undefined
        }
      />

      <Card>
        {!notifications ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Nenhum alerta por aqui" description="Quando houver eventos relevantes (conexão, erro, automação concluída, opt-out), eles aparecerão aqui." />
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Info;
              return (
                <li key={n.id} className={clsx("px-5 py-4 flex items-start gap-3", !n.readAt && "bg-surfaceHover/40")}>
                  <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TYPE_COLOR[n.type] ?? TYPE_COLOR.GENERIC)}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <span className="text-xs text-muted shrink-0">{new Date(n.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm text-muted mt-0.5">{n.message}</p>
                  </div>
                  {!n.readAt && (
                    <button onClick={() => markRead(n.id)} className="text-xs text-primary hover:underline shrink-0">
                      Marcar como lida
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
