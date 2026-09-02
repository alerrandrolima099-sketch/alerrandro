"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("@whatsapp-saas/config");
// Criptografia simétrica (AES-256-GCM) para credenciais sensíveis de provedores
// (tokens de instância) armazenadas em Instance.providerConfig.
// Nunca logar o valor em texto puro (ver regra de segurança da seção 24).
const ALGORITHM = "aes-256-gcm";
function getKey() {
    const key = config_1.env.ENCRYPTION_KEY;
    return crypto_1.default.createHash("sha256").update(key).digest(); // normaliza para 32 bytes
}
function encrypt(plainText) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}
function decrypt(payload) {
    const raw = Buffer.from(payload, "base64");
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
