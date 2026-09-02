import { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  hideBelow?: "md" | "lg";
  /** Fields shown in the mobile card variant; omit to skip in card view. */
  cardLabel?: string;
};

const HIDE_CLASS: Record<string, string> = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function ResponsiveTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-muted text-sm">{emptyMessage}</p>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted text-left border-b border-border">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-normal ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surfaceHover/50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle ${col.hideBelow ? HIDE_CLASS[col.hideBelow] : ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="p-4 space-y-1.5">
            {columns.map((col) => (
              <div key={col.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted text-xs shrink-0">{col.cardLabel ?? col.header}</span>
                <span className="text-right min-w-0">{col.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
