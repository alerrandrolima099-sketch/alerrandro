import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

/**
 * Fundação visual do redesign "Central de Aquecimento" (seção 38). Estado
 * vazio padrão (sem números aquecendo, sem automações, sem alertas etc) -
 * substitui os vários "Nenhum X cadastrado ainda" espalhados como texto
 * solto pelas páginas hoje.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-12 h-12 rounded-xl bg-surfaceHover flex items-center justify-center mb-4">
        <Icon size={22} className="text-muted" />
      </div>
      <h3 className="font-medium mb-1">{title}</h3>
      {description && <p className="text-sm text-muted max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
