import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";

const VARIANT_CLASS: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  info: "bg-info/15 text-info",
  fire: "bg-fire/15 text-fire",
  neutral: "bg-gray-500/15 text-gray-400",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  variant = "primary",
  trend,
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** @deprecated use `variant` instead; kept for backward compatibility. */
  accent?: string;
  variant?: keyof typeof VARIANT_CLASS;
  /** Percentage change, positive or negative. Omit when there's no trend data. */
  trend?: number;
  hint?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-start gap-4">
      <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", accent ?? VARIANT_CLASS[variant])}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          {trend !== undefined && (
            <span className={clsx("flex items-center gap-0.5 text-xs font-medium", trend >= 0 ? "text-success" : "text-danger")}>
              {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="text-sm text-muted truncate">{label}</div>
        {hint && <div className="text-xs text-muted/70 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}
