import { ReactNode } from "react";

/**
 * Fundação visual do redesign "Central de Aquecimento" (seção 38). Padrão de
 * responsividade para listas: mostra a tabela normal em telas >= md e troca
 * por uma pilha de cards em telas menores, sem duplicar a lógica de dados
 * em cada página. A própria página monta a <table> (desktop) e a função de
 * card (mobile) usando os mesmos dados.
 *
 * Uso típico:
 *   <MobileCardList
 *     items={pairs}
 *     keyFor={(p) => p.id}
 *     table={<table>...</table>}
 *     renderCard={(p) => <div className="bg-surface ...">...</div>}
 *   />
 */
export function MobileCardList<T>({
  items,
  table,
  renderCard,
  keyFor,
}: {
  items: T[];
  table: ReactNode;
  renderCard: (item: T) => ReactNode;
  keyFor: (item: T) => string;
}) {
  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={keyFor(item)}>{renderCard(item)}</div>
        ))}
      </div>
    </>
  );
}
