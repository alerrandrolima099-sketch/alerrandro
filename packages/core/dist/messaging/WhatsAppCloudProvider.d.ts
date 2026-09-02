import { MessagingProvider, SendResult, SendTextMessageParams, ConnectInstanceResult, SendGroupInviteParams } from "./MessagingProvider";
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
export declare class WhatsAppCloudProvider implements MessagingProvider {
    readonly name = "WHATSAPP_CLOUD_API";
    private assertConfigured;
    connectInstance(_instanceId: string): Promise<ConnectInstanceResult>;
    disconnectInstance(_instanceId: string): Promise<void>;
    sendTextMessage(params: SendTextMessageParams): Promise<SendResult>;
    sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult>;
    verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}
