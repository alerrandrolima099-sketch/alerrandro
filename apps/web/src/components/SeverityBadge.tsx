import clsx from "clsx";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, LucideIcon } from "lucide-react";

/**
 * Fundação visual do redesign "Central de Aquecimento" (seção 38). Badge de
 * severidade, separado do Badge de status (que representa o estado de uma
 * entidade - CONNECTED/PAUSED/etc). Este aqui representa importância de um
 * evento/alerta: info, sucesso, atenção ou crítico. Será reaproveitado em
 * Alertas e Relatórios.
 */
export type Severity = "info" | "success" | "warning" | "critical";

const SEVERITY_STYLES: Record<Severity, { pill: string; icon: LucideIcon }> = {
  info: { pill: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Info },
  success: { pill: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
  warning: { pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: AlertTriangle },
  critical: { pill: "bg-red-500/15 text-red-400 border-red-500/20", icon: AlertOctagon },
};

export function SeverityBadge({
  severity,
  children,
}: {
  severity: Severity;
  children: React.ReactNode;
}) {
  const { pill, icon: Icon } = SEVERITY_STYLES[severity];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0",
        pill
      )}
    >
      <Icon size={12} className="shrink-0" />
      {children}
    </span>
  );
}
