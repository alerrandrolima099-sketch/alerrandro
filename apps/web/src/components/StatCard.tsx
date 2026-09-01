import { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: LucideIcon; accent?: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent ?? "bg-primary/15 text-primary"}`}>
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted">{label}</div>
      </div>
    </div>
  );
}
