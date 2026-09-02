/**
 * Contrato oficial que qualquer provedor de mensageria deve implementar.
 * Toda a aplicação (workers, automation engine, sender pool) fala apenas
 * com esta interface - nunca diretamente com um SDK de provedor.
 *
 * Isso permite trocar/adicionar provedores (ex: uma futura API oficial
 * adicional) sem tocar no resto do sistema (seção 6 e 31).
 */
export type SendTextMessageParams = {
    instanceId: string;
    to: string;
    text: string;
    idempotencyKey: string;
};
export type SendResult = {
    providerMessageId: string;
    status: "SENT" | "FAILED";
    error?: string;
};
export type ConnectInstanceResult = {
    status: "CONNECTED" | "CONNECTING" | "ERROR";
    qrCode?: string;
    error?: string;
};
export type SendGroupInviteParams = {
    instanceId: string;
    to: string;
    inviteLink: string;
};
export interface MessagingProvider {
    readonly name: string;
    connectInstance(instanceId: string): Promise<ConnectInstanceResult>;
    disconnectInstance(instanceId: string): Promise<void>;
    sendTextMessage(params: SendTextMessageParams): Promise<SendResult>;
    sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult>;
    verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}
