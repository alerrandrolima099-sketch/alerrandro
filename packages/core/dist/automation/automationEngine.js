"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationEngine = exports.AutomationEngine = void 0;
const database_1 = require("@whatsapp-saas/database");
const queueService_1 = require("../queues/queueService");
const crypto_1 = require("crypto");
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
class AutomationEngine {
    /** Cria uma execução para uma sessão e agenda o primeiro passo (node START). */
    async startExecution(automationId, sessionId) {
        const automation = await database_1.prisma.automation.findUniqueOrThrow({
            where: { id: automationId },
            include: { nodes: true },
        });
        const startNode = automation.nodes.find((n) => n.type === "START");
        if (!startNode) {
            throw new Error("Automação sem node START configurado");
        }
        const execution = await database_1.prisma.automationExecution.create({
            data: {
                automationId,
                sessionId,
                currentNodeId: startNode.id,
                status: "RUNNING",
                context: {},
            },
        });
        await (0, queueService_1.enqueueAutomationExecute)({ executionId: execution.id });
        return execution;
    }
    /**
     * Processa um único passo da execução: executa a ação do node atual e
     * decide o próximo node (ou finaliza). Chamado pelo worker.
     */
    async processStep(executionId) {
        const execution = await database_1.prisma.automationExecution.findUniqueOrThrow({
            where: { id: executionId },
            include: {
                automation: { include: { nodes: true } },
                session: { include: { contact: true, conversation: true } },
            },
        });
        if (execution.status !== "RUNNING")
            return execution;
        const currentNode = execution.automation.nodes.find((n) => n.id === execution.currentNodeId);
        if (!currentNode) {
            return database_1.prisma.automationExecution.update({ where: { id: executionId }, data: { status: "FAILED" } });
        }
        const contact = execution.session.contact;
        switch (currentNode.type) {
            case "START":
                break;
            case "SEND_MESSAGE": {
                // Nunca envia se o contato não tiver consentimento ativo (seções 9/25).
                if (contact.status !== "ACTIVE") {
                    return database_1.prisma.automationExecution.update({ where: { id: executionId }, data: { status: "CANCELLED" } });
                }
                const config = currentNode.config ?? {};
                if (execution.session.conversationId && config.text) {
                    await database_1.prisma.message.create({
                        data: {
                            conversationId: execution.session.conversationId,
                            instanceId: execution.session.instanceId,
                            contactId: contact.id,
                            direction: "OUTBOUND",
                            status: "QUEUED",
                            content: config.text,
                        },
                    });
                    await (0, queueService_1.enqueueSendMessage)({
                        tenantId: execution.session.tenantId,
                        instanceId: execution.session.instanceId,
                        conversationId: execution.session.conversationId,
                        contactId: contact.id,
                        content: config.text,
                        idempotencyKey: (0, crypto_1.randomUUID)(),
                    });
                }
                break;
            }
            case "WAIT": {
                const config = currentNode.config ?? {};
                const delayMs = (config.seconds ?? 30) * 1000;
                const nextNodeId = currentNode.nextNodeIds[0];
                await database_1.prisma.automationExecution.update({
                    where: { id: executionId },
                    data: { currentNodeId: nextNodeId, status: nextNodeId ? "RUNNING" : "COMPLETED" },
                });
                if (nextNodeId) {
                    await (0, queueService_1.enqueueAutomationExecute)({ executionId }, delayMs);
                }
                return execution;
            }
            case "WAIT_FOR_REPLY": {
                // Marca como aguardando; um evento de mensagem recebida (webhook) é
                // quem deve retomar esta execução chamando resumeAfterReply().
                await database_1.prisma.automationExecution.update({ where: { id: executionId }, data: { status: "WAITING" } });
                return execution;
            }
            case "TAG_CONTACT": {
                const config = currentNode.config ?? {};
                if (config.tag) {
                    const tags = Array.from(new Set([...contact.tags, config.tag]));
                    await database_1.prisma.contact.update({ where: { id: contact.id }, data: { tags } });
                }
                break;
            }
            case "REMOVE_TAG": {
                const config = currentNode.config ?? {};
                if (config.tag) {
                    await database_1.prisma.contact.update({ where: { id: contact.id }, data: { tags: contact.tags.filter((t) => t !== config.tag) } });
                }
                break;
            }
            case "CONDITION": {
                // Avaliação simples baseada em tag presente no contato.
                const config = currentNode.config ?? {};
                const conditionMet = config.hasTag ? contact.tags.includes(config.hasTag) : false;
                const nextNodeId = conditionMet ? config.trueNodeId : config.falseNodeId;
                await database_1.prisma.automationExecution.update({
                    where: { id: executionId },
                    data: { currentNodeId: nextNodeId, status: nextNodeId ? "RUNNING" : "COMPLETED" },
                });
                if (nextNodeId)
                    await (0, queueService_1.enqueueAutomationExecute)({ executionId });
                return execution;
            }
            case "SEND_INVITE": {
                // Delegado ao módulo de grupos (ver groups.service) via evento; aqui
                // apenas seguimos o fluxo. A oferta/consentimento é responsabilidade
                // da tela de conversas / groups.
                break;
            }
            case "TRANSFER": {
                if (execution.session.conversationId) {
                    await database_1.prisma.conversation.update({ where: { id: execution.session.conversationId }, data: { automationPaused: true } });
                }
                return database_1.prisma.automationExecution.update({ where: { id: executionId }, data: { status: "COMPLETED" } });
            }
            case "END":
                return database_1.prisma.automationExecution.update({ where: { id: executionId }, data: { status: "COMPLETED" } });
        }
        const nextNodeId = currentNode.nextNodeIds[0];
        const updated = await database_1.prisma.automationExecution.update({
            where: { id: executionId },
            data: { currentNodeId: nextNodeId, status: nextNodeId ? "RUNNING" : "COMPLETED" },
        });
        if (nextNodeId) {
            await (0, queueService_1.enqueueAutomationExecute)({ executionId });
        }
        return updated;
    }
    /** Chamado pelo webhook.processor ao chegar uma resposta do contato. */
    async resumeAfterReply(sessionId) {
        const execution = await database_1.prisma.automationExecution.findFirst({
            where: { sessionId, status: "WAITING" },
            orderBy: { createdAt: "desc" },
        });
        if (!execution)
            return null;
        const node = await database_1.prisma.automationNode.findUnique({ where: { id: execution.currentNodeId ?? "" } });
        const nextNodeId = node?.nextNodeIds[0];
        const updated = await database_1.prisma.automationExecution.update({
            where: { id: execution.id },
            data: { currentNodeId: nextNodeId, status: nextNodeId ? "RUNNING" : "COMPLETED" },
        });
        if (nextNodeId)
            await (0, queueService_1.enqueueAutomationExecute)({ executionId: execution.id });
        return updated;
    }
}
exports.AutomationEngine = AutomationEngine;
exports.automationEngine = new AutomationEngine();
