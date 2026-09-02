import { ReactNode } from "react";

/**
 * Fundação visual do redesign "Central de Aquecimento" (seção 38). Wrapper
 * padrão para gráficos (recharts, já presente no package.json - nenhuma
 * dependência nova). Dá o mesmo cabeçalho/card/estado de loading e vazio
 * pra todo gráfico do produto (Dashboard, Central de Aquecimento,
 * Relatórios), em vez de cada página reinventar o layout.
 *
 * Uso típico:
 *   <ChartCard title="Mensagens por dia" height={240}>
 *     <ResponsiveContainer width="100%" height="100%">
 *       <LineChart data={...}>...</LineChart>
 *     </ResponsiveContainer>
 *   </ChartCard>
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  loading,
  empty,
  emptyMessage = "Sem dados para exibir no período.",
  height = 260,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-medium truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {loading ? (
        <div className="animate-pulse bg-surfaceHover rounded-lg" style={{ height }} />
      ) : empty ? (
        <div className="flex items-center justify-center text-sm text-muted text-center px-4" style={{ height }}>
          {emptyMessage}
        </div>
      ) : (
        <div style={{ height }}>{children}</div>
      )}
    </div>
  );
}
