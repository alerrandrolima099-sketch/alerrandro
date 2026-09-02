import { Lock } from "lucide-react";
import { ReactNode } from "react";

/** Small inline badge marking a field/feature that has no real backend support yet. */
export function RequiresBackendBadge({ label = "Requer backend" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-info/10 text-info rounded-full px-2 py-0.5">
      <Lock size={11} /> {label}
    </span>
  );
}

/** Larger explanatory panel for a whole section that is UI-only for now. */
export function RequiresBackendNotice({
  title = "Recurso em breve",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-dashed border-info/30 bg-info/5 rounded-xl p-4 flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-info/15 text-info flex items-center justify-center shrink-0">
        <Lock size={16} />
      </div>
      <div>
        <p className="text-sm font-medium text-info mb-0.5">{title}</p>
        <p className="text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}
