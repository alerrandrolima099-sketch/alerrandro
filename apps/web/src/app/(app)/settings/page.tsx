"use client";

import { useEffect, useState } from "react";
import {
  UserCircle, Smartphone, Flame, Workflow, Bell, ShieldCheck, ScrollText, MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ResponsiveTable, Column } from "@/components/ui/ResponsiveTable";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { RequiresBackendNotice, RequiresBackendBadge } from "@/components/ui/RequiresBackend";
import { useToast } from "@/components/ui/Toast";

type Log = { id: string; action: string; resource: string; resourceId: string | null; createdAt: string; ip: string | null };

const TABS = [
  { key: "account", label: "Conta", icon: <UserCircle size={14} /> },
  { key: "whatsapp", label: "WhatsApp", icon: <MessageSquare size={14} /> },
  { key: "numbers", label: "Números", icon: <Smartphone size={14} /> },
  { key: "warmup", label: "Aquecimento", icon: <Flame size={14} /> },
  { key: "automations", label: "Automações", icon: <Workflow size={14} /> },
  { key: "notifications", label: "Notificações", icon: <Bell size={14} /> },
  { key: "security", label: "Segurança", icon: <ShieldCheck size={14} /> },
  { key: "logs", label: "Logs", icon: <ScrollText size={14} /> },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("account");

  return (
    <div>
      <PageHeader title="Configurações" description="Conta, número, aquecimento, automações e segurança." />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "account" && <AccountTab />}
      {tab === "whatsapp" && (
        <PlaceholderTab
          title="Configuração de conta WhatsApp Business"
          description="Parâmetros gerais de conta oficial (webhook, verificação, catálogo) ainda não têm um modelo de dados dedicado no backend."
        />
      )}
      {tab === "numbers" && (
        <PlaceholderTab
          title="Preferências por número"
          description="Limites e preferências específicas por número (fora de conectar/desconectar/excluir) ainda não são suportados pelo backend. Para gerenciar seus números, use a página Meus Números."
        />
      )}
      {tab === "warmup" && (
        <PlaceholderTab
          title="Estratégia global de aquecimento"
          description="Perfis de aquecimento, intensidade padrão e limites globais ainda não têm suporte no backend. Uma configuração por atividade pode ser vista na página Aquecimento."
        />
      )}
      {tab === "automations" && (
        <PlaceholderTab
          title="Preferências de automação"
          description="Parâmetros globais de automação (fora de criar/ativar/pausar/arquivar) ainda não são suportados pelo backend."
        />
      )}
      {tab === "notifications" && (
        <PlaceholderTab
          title="Preferências de notificação"
          description="Escolher canais e tipos de alerta ainda não é suportado pelo backend. Os alertas já gerados podem ser vistos na página Alertas."
        />
      )}
      {tab === "security" && <SecurityTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

function AccountTab() {
  const { user } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label className="text-sm text-muted block mb-1.5">ID do usuário</label>
            <input disabled value={user?.sub ?? "—"} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted" />
          </div>
          <div>
            <label className="text-sm text-muted block mb-1.5">Perfil de acesso</label>
            <input disabled value={user?.role ?? "—"} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-muted" />
          </div>
        </div>
        <div className="max-w-xl">
          <label className="text-sm text-muted flex items-center gap-2 mb-1.5">
            Nome e foto de exibição <RequiresBackendBadge />
          </label>
          <input disabled placeholder="Ainda não suportado pelo backend" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed" />
        </div>
      </CardBody>
    </Card>
  );
}

function SecurityTab() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/auth/change-password", { method: "POST", body: form });
      showToast("Senha alterada com sucesso.", "success");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={changePassword} className="space-y-4 max-w-md">
            <div>
              <label className="text-sm text-muted block mb-1.5">Senha atual</label>
              <input
                type="password"
                required
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-muted block mb-1.5">Nova senha (mín. 8 caracteres)</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button disabled={saving} className="bg-primary text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autenticação em duas etapas</CardTitle>
        </CardHeader>
        <CardBody>
          <RequiresBackendNotice>
            2FA ainda não é suportado pelo backend de autenticação atual.
          </RequiresBackendNotice>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="font-medium mb-2">Sobre este SaaS</h2>
          <p className="text-sm text-muted">
            Esta versão não possui sistema de cobrança ou planos de assinatura — o acesso é liberado
            integralmente. A arquitetura já está preparada para, futuramente, adicionar planos sem
            necessidade de reescrever o restante do sistema.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<Log[] | null>(null);

  useEffect(() => {
    api<{ data: Log[] }>("/logs").then((r) => setLogs(r.data));
  }, []);

  const columns: Column<Log>[] = [
    { key: "action", header: "Ação", render: (l) => l.action },
    {
      key: "resource",
      header: "Recurso",
      hideBelow: "md",
      render: (l) => `${l.resource}${l.resourceId ? ` #${l.resourceId.slice(0, 8)}` : ""}`,
    },
    { key: "ip", header: "IP", hideBelow: "lg", render: (l) => l.ip ?? "—" },
    { key: "date", header: "Data", render: (l) => new Date(l.createdAt).toLocaleString("pt-BR") },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auditoria de ações</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {!logs ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : (
          <ResponsiveTable columns={columns} rows={logs} emptyMessage="Nenhum log registrado." />
        )}
      </CardBody>
    </Card>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardBody>
        <RequiresBackendNotice title={title}>{description}</RequiresBackendNotice>
      </CardBody>
    </Card>
  );
}
