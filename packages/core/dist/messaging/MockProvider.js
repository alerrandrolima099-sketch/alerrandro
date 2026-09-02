"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockProvider = void 0;
const crypto_1 = require("crypto");
/**
 * Provedor de desenvolvimento/teste. Não se conecta a nenhum serviço real -
 * simula respostas de sucesso para permitir desenvolver e testar toda a
 * aplicação (filas, automation engine, UI) sem credenciais.
 *
 * NUNCA usar em produção - env.MESSAGING_PROVIDER deve ser trocado para
 * um provedor oficial real (ex: WhatsAppCloudProvider) antes do go-live.
 */
class MockProvider {
    constructor() {
        this.name = "MOCK";
    }
    async connectInstance(_instanceId) {
        return { status: "CONNECTED" };
    }
    async disconnectInstance(_instanceId) {
        return;
    }
    async sendTextMessage(params) {
        // eslint-disable-next-line no-console
        console.log(`[MockProvider] sendTextMessage -> to=${params.to} text="${params.text}"`);
        return { providerMessageId: `mock_${(0, crypto_1.randomUUID)()}`, status: "SENT" };
    }
    async sendGroupInvite(params) {
        // eslint-disable-next-line no-console
        console.log(`[MockProvider] sendGroupInvite -> to=${params.to} link=${params.inviteLink}`);
        return { providerMessageId: `mock_invite_${(0, crypto_1.randomUUID)()}`, status: "SENT" };
    }
    verifyWebhookSignature(_rawBody, _signatureHeader) {
        return true;
    }
}
exports.MockProvider = MockProvider;
