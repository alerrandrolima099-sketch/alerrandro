"use strict";
// Tipos compartilhados entre api / worker / web.
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = void 0;
// Nomes das filas BullMQ - usados por api e worker para não divergirem.
exports.QUEUE_NAMES = {
    MESSAGE: "messageQueue",
    SESSION: "sessionQueue",
    AUTOMATION: "automationQueue",
    WEBHOOK: "webhookQueue",
    NOTIFICATION: "notificationQueue",
};
