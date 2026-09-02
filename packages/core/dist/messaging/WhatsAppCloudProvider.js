"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppCloudProvider = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("@whatsapp-saas/config");
/**
 * Adapter para a API oficial WhatsApp Business Cloud API (Meta).
 *
 * IMPORTANTE - CREDENCIAIS NECESSÁRIAS ANTES DE USAR EM PRODUÇÃO:
 *   MESSAGING_API_URL   -> ex: https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>
 *   MESSAGING_API_TOKEN -> token de acesso permanente do WhatsApp Business
 *   WEBHOOK_SECRET      -> app secret usado para validar a assinatura X-Hub-Signature-256
 *
 * Ativar trocando MESSAGING_PROVIDER=WHATSAPP_CLOUD_API no .env, DEPOIS de
 * configurar as credenciais acima. Sem elas as chamadas falham de forma
 * explícita (fail-fast) - nunca simulamos sucesso.
 *
 * Grupos/comunidades: a Cloud API oficial não expõe endpoint de "adicionar
 * contato a grupo automaticamente". sendGroupInvite envia apenas o LINK
 * oficial de convite como mensagem de texto para quem já aceitou recebê-lo.
 */
class WhatsAppCloudProvider {
    constructor() {
        this.name = "WHATSAPP_CLOUD_API";
    }
    assertConfigured() {
        if (!config_1.env.MESSAGING_API_URL || !config_1.env.MESSAGING_API_TOKEN) {
            throw new Error("WhatsAppCloudProvider não está configurado. Defina MESSAGING_API_URL e MESSAGING_API_TOKEN no .env.");
        }
    }
    async connectInstance(_instanceId) {
        this.assertConfigured();
        try {
            const res = await fetch(`${config_1.env.MESSAGING_API_URL}?fields=verified_name`, {
                headers: { Authorization: `Bearer ${config_1.env.MESSAGING_API_TOKEN}` },
            });
            if (!res.ok) {
                return { status: "ERROR", error: `HTTP ${res.status}` };
            }
            return { status: "CONNECTED" };
        }
        catch (err) {
            return { status: "ERROR", error: err.message };
        }
    }
    async disconnectInstance(_instanceId) {
        return;
    }
    async sendTextMessage(params) {
        this.assertConfigured();
        try {
            const res = await fetch(`${config_1.env.MESSAGING_API_URL}/messages`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config_1.env.MESSAGING_API_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: params.to,
                    type: "text",
                    text: { body: params.text },
                }),
            });
            const data = (await res.json());
            if (!res.ok) {
                return { providerMessageId: "", status: "FAILED", error: JSON.stringify(data) };
            }
            return { providerMessageId: data?.messages?.[0]?.id ?? "", status: "SENT" };
        }
        catch (err) {
            return { providerMessageId: "", status: "FAILED", error: err.message };
        }
    }
    async sendGroupInvite(params) {
        return this.sendTextMessage({
            instanceId: params.instanceId,
            to: params.to,
            text: `Você foi convidado para nossa comunidade: ${params.inviteLink}`,
            idempotencyKey: `invite_${params.to}_${params.inviteLink}`,
        });
    }
    verifyWebhookSignature(rawBody, signatureHeader) {
        if (!signatureHeader)
            return false;
        const expected = "sha256=" + crypto_1.default.createHmac("sha256", config_1.env.WEBHOOK_SECRET).update(rawBody).digest("hex");
        const a = Buffer.from(expected);
        const b = Buffer.from(signatureHeader);
        if (a.length !== b.length)
            return false;
        return crypto_1.default.timingSafeEqual(a, b);
    }
}
exports.WhatsAppCloudProvider = WhatsAppCloudProvider;
