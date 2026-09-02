import { MessagingProvider, SendResult, SendTextMessageParams, ConnectInstanceResult, SendGroupInviteParams } from "./MessagingProvider";
/**
 * Provedor de desenvolvimento/teste. Não se conecta a nenhum serviço real -
 * simula respostas de sucesso para permitir desenvolver e testar toda a
 * aplicação (filas, automation engine, UI) sem credenciais.
 *
 * NUNCA usar em produção - env.MESSAGING_PROVIDER deve ser trocado para
 * um provedor oficial real (ex: WhatsAppCloudProvider) antes do go-live.
 */
export declare class MockProvider implements MessagingProvider {
    readonly name = "MOCK";
    connectInstance(_instanceId: string): Promise<ConnectInstanceResult>;
    disconnectInstance(_instanceId: string): Promise<void>;
    sendTextMessage(params: SendTextMessageParams): Promise<SendResult>;
    sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult>;
    verifyWebhookSignature(_rawBody: string, _signatureHeader: string | undefined): boolean;
}
