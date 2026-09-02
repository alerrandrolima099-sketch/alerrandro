"use strict";
/**
 * Contrato oficial que qualquer provedor de mensageria deve implementar.
 * Toda a aplicação (workers, automation engine, sender pool) fala apenas
 * com esta interface - nunca diretamente com um SDK de provedor.
 *
 * Isso permite trocar/adicionar provedores (ex: uma futura API oficial
 * adicional) sem tocar no resto do sistema (seção 6 e 31).
 */
Object.defineProperty(exports, "__esModule", { value: true });
