import { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="group bg-surface border border-border rounded-xl p-4 flex items-center gap-4 transition-all hover:border-borderLight hover:-translate-y-0.5 hover:shadow-card">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
          accent ?? "bg-primary/15 text-primary"
        }`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="text-sm text-muted truncate">{label}</div>
      </div>
    </div>
  );
}
