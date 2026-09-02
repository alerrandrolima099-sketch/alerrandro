import { MessagingProvider, SendResult, SendTextMessageParams, ConnectInstanceResult, SendGroupInviteParams, JoinGroupParams, JoinGroupResult } from "./MessagingProvider";
import { randomUUID } from "crypto";

/**
 * Provedor de desenvolvimento/teste. Não se conecta a nenhum serviço real -
 * simula respostas de sucesso para permitir desenvolver e testar toda a
 * aplicação (filas, automation engine, UI) sem credenciais.
 *
 * NUNCA usar em produção - env.MESSAGING_PROVIDER deve ser trocado para
 * um provedor oficial real (ex: WhatsAppCloudProvider) antes do go-live.
 */
export class MockProvider implements MessagingProvider {
  readonly name = "MOCK";

  async connectInstance(_instanceId: string): Promise<ConnectInstanceResult> {
    return { status: "CONNECTED" };
  }

  async disconnectInstance(_instanceId: string): Promise<void> {
    return;
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(`[MockProvider] sendTextMessage -> to=${params.to} text="${params.text}"`);
    return { providerMessageId: `mock_${randomUUID()}`, status: "SENT" };
  }

  async sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult> {
    // eslint-disable-next-line no-console
    console.log(`[MockProvider] sendGroupInvite -> to=${params.to} link=${params.inviteLink}`);
    return { providerMessageId: `mock_invite_${randomUUID()}`, status: "SENT" };
  }

  async joinGroup(params: JoinGroupParams): Promise<JoinGroupResult> {
    // eslint-disable-next-line no-console
    console.log(`[MockProvider] joinGroup -> instanceId=${params.instanceId} inviteCode=${params.inviteCode}`);
    return { status: "JOINED" };
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string | undefined): boolean {
    return true;
  }
}
