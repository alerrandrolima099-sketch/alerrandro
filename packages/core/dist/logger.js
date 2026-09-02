"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLog = writeLog;
const database_1 = require("@whatsapp-saas/database");
// Logger de auditoria - grava em tabela Log (seção 16).
// IMPORTANTE: nunca passar tokens/secrets em `metadata`.
async function writeLog(params) {
    try {
        await database_1.prisma.log.create({
            data: {
                tenantId: params.tenantId,
                userId: params.userId ?? undefined,
                action: params.action,
                resource: params.resource,
                resourceId: params.resourceId ?? undefined,
                metadata: params.metadata,
                ip: params.ip ?? undefined,
            },
        });
    }
    catch (err) {
        // Log nunca deve derrubar o fluxo principal da aplicação.
        // eslint-disable-next-line no-console
        console.error("[logger] failed to persist log", err);
    }
}
