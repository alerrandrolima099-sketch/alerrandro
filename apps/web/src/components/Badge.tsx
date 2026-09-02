import clsx from "clsx";

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  CONNECTED: { pill: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  ACTIVE: { pill: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  AVAILABLE: { pill: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  COMPLETED: { pill: "bg-green-500/15 text-green-400 border-green-500/20", dot: "bg-green-400" },
  CONNECTING: { pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400 animate-pulse" },
  WAITING: { pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  BUSY: { pill: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-400" },
  DISCONNECTED: { pill: "bg-gray-500/15 text-gray-400 border-gray-500/20", dot: "bg-gray-400" },
  ARCHIVED: { pill: "bg-gray-500/15 text-gray-400 border-gray-500/20", dot: "bg-gray-400" },
  PAUSED: { pill: "bg-blue-500/15 text-blue-400 border-blue-500/20", dot: "bg-blue-400" },
  ERROR: { pill: "bg-red-500/15 text-red-400 border-red-500/20", dot: "bg-red-400" },
  OPTED_OUT: { pill: "bg-red-500/15 text-red-400 border-red-500/20", dot: "bg-red-400" },
  BLOCKED: { pill: "bg-red-500/15 text-red-400 border-red-500/20", dot: "bg-red-400" },
  CANCELLED: { pill: "bg-gray-500/15 text-gray-400 border-gray-500/20", dot: "bg-gray-400" },
  DRAFT: { pill: "bg-gray-500/15 text-gray-400 border-gray-500/20", dot: "bg-gray-400" },
};

const FALLBACK = { pill: "bg-gray-500/15 text-gray-400 border-gray-500/20", dot: "bg-gray-400" };

export function Badge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? FALLBACK;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
        style.pill
      )}
    >
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {status}
    </span>
  );
}
