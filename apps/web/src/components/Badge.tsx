import clsx from "clsx";

const STATUS_COLORS: Record<string, string> = {
  CONNECTED: "bg-green-500/15 text-green-400",
  ACTIVE: "bg-green-500/15 text-green-400",
  AVAILABLE: "bg-green-500/15 text-green-400",
  COMPLETED: "bg-green-500/15 text-green-400",
  CONNECTING: "bg-yellow-500/15 text-yellow-400",
  WAITING: "bg-yellow-500/15 text-yellow-400",
  BUSY: "bg-yellow-500/15 text-yellow-400",
  DISCONNECTED: "bg-gray-500/15 text-gray-400",
  ARCHIVED: "bg-gray-500/15 text-gray-400",
  PAUSED: "bg-blue-500/15 text-blue-400",
  ERROR: "bg-red-500/15 text-red-400",
  OPTED_OUT: "bg-red-500/15 text-red-400",
  BLOCKED: "bg-red-500/15 text-red-400",
  CANCELLED: "bg-gray-500/15 text-gray-400",
  DRAFT: "bg-gray-500/15 text-gray-400",
};

export function Badge({ status }: { status: string }) {
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[status] ?? "bg-gray-500/15 text-gray-400")}>
      {status}
    </span>
  );
}
