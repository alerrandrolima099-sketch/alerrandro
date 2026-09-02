/**
 * Automation Engine (seção 10) - separado de QueueService e MessagingProvider
 * (seção 31). Interpreta o grafo de nodes de uma Automation e avança a
 * execução (AutomationExecution) node a node.
 *
 * Este engine é chamado pelo worker (automation.processor.ts) quando um job
 * "execute-automation" é consumido. A API apenas cria a AutomationExecution
 * inicial e enfileira o primeiro passo - toda a interpretação do fluxo roda
 * aqui, para manter a lógica de negócio fora da camada de transporte HTTP.
 */
export declare class AutomationEngine {
    /** Cria uma execução para uma sessão e agenda o primeiro passo (node START). */
    startExecution(automationId: string, sessionId: string): Promise<any>;
    /**
     * Processa um único passo da execução: executa a ação do node atual e
     * decide o próximo node (ou finaliza). Chamado pelo worker.
     */
    processStep(executionId: string): Promise<any>;
    /** Chamado pelo webhook.processor ao chegar uma resposta do contato. */
    resumeAfterReply(sessionId: string): Promise<any>;
}
export declare const automationEngine: AutomationEngine;
