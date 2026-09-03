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
  to: string; // telefone E.164
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
  // Código de pareamento (8 caracteres) - preenchido em vez de qrCode quando
  // a conexão foi pedida com um número de telefone (ver BaileysProvider).
  pairingCode?: string;
  error?: string;
};

export type SendGroupInviteParams = {
  instanceId: string;
  to: string;
  inviteLink: string;
};

// Entrar em um grupo com todos os números (seção 15/38): diferente de
// sendGroupInvite (manda o LINK como texto para um contato), isto faz a
// PRÓPRIA instância entrar no grupo de verdade, usando o código do convite
// (o trecho da URL depois de https://chat.whatsapp.com/). Só é suportado de
// fato pelo BaileysProvider (WHATSAPP_QR) - a Cloud API oficial não tem
// endpoint equivalente, então WhatsAppCloudProvider sempre retorna FAILED.
export type JoinGroupParams = {
  instanceId: string;
  inviteCode: string;
};

export type JoinGroupResult = {
  status: "JOINED" | "FAILED";
  error?: string;
};

export interface MessagingProvider {
  readonly name: string;
  connectInstance(instanceId: string): Promise<ConnectInstanceResult>;
  disconnectInstance(instanceId: string): Promise<void>;
  sendTextMessage(params: SendTextMessageParams): Promise<SendResult>;
  sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult>;
  joinGroup(params: JoinGroupParams): Promise<JoinGroupResult>;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}
