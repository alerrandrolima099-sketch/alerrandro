import clsx from "clsx";

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: "bg-success/15 text-success",
  ACTIVE: "bg-success/15 text-success",
  AVAILABLE: "bg-success/15 text-success",
  COMPLETED: "bg-success/15 text-success",
  READ: "bg-success/15 text-success",
  DELIVERED: "bg-success/15 text-success",
  SENT: "bg-success/15 text-success",
  CONNECTING: "bg-warning/15 text-warning",
  WAITING: "bg-warning/15 text-warning",
  BUSY: "bg-warning/15 text-warning",
  QUEUED: "bg-warning/15 text-warning",
  DISCONNECTED: "bg-gray-500/15 text-gray-400",
  ARCHIVED: "bg-gray-500/15 text-gray-400",
  DRAFT: "bg-gray-500/15 text-gray-400",
  CANCELLED: "bg-gray-500/15 text-gray-400",
  PAUSED: "bg-info/15 text-info",
  ERROR: "bg-danger/15 text-danger",
  FAILED: "bg-danger/15 text-danger",
  OPTED_OUT: "bg-danger/15 text-danger",
  BLOCKED: "bg-danger/15 text-danger",
};

/** Labels de exibição em português para os mesmos valores de status do backend (não altera os valores reais). */
const STATUS_LABELS: Record<string, string> = {
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  ERROR: "Erro",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  WAITING: "Em fila",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  BUSY: "Ocupado",
  AVAILABLE: "Disponível",
  OPTED_OUT: "Removido",
  BLOCKED: "Bloqueado",
  QUEUED: "Na fila",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
};

export function Badge({
  status,
  label,
  variant,
}: {
  /** Valor bruto vindo do backend, usado para escolher a cor. */
  status: string;
  /** Texto customizado a exibir; por padrão traduz `status` para português. */
  label?: string;
  /** Sobrescreve a cor calculada a partir de `status`. */
  variant?: "success" | "warning" | "danger" | "info" | "neutral" | "fire";
}) {
  const variantClass: Record<string, string> = {
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-info/15 text-info",
    neutral: "bg-gray-500/15 text-gray-400",
    fire: "bg-fire/15 text-fire",
  };

  const colorClass = variant ? variantClass[variant] : STATUS_COLORS[status] ?? "bg-gray-500/15 text-gray-400";

  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", colorClass)}>
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}
