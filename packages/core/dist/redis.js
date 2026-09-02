"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@whatsapp-saas/config");
// Conexão única do Redis reutilizada por rate-limit, locks e BullMQ (via connection option).
exports.redisConnection = new ioredis_1.default(config_1.env.REDIS_URL, {
    maxRetriesPerRequest: null, // exigido pelo BullMQ
});
exports.redisConnection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] connection error:", err.message);
});
