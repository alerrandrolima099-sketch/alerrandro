import crypto from "crypto";
import { MessagingProvider, SendResult, SendTextMessageParams, ConnectInstanceResult, SendGroupInviteParams, JoinGroupParams, JoinGroupResult } from "./MessagingProvider";
import { env } from "@whatsapp-saas/config";

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
export class WhatsAppCloudProvider implements MessagingProvider {
  readonly name = "WHATSAPP_CLOUD_API";

  private assertConfigured() {
    if (!env.MESSAGING_API_URL || !env.MESSAGING_API_TOKEN) {
      throw new Error(
        "WhatsAppCloudProvider não está configurado. Defina MESSAGING_API_URL e MESSAGING_API_TOKEN no .env."
      );
    }
  }

  async connectInstance(_instanceId: string): Promise<ConnectInstanceResult> {
    this.assertConfigured();
    try {
      const res = await fetch(`${env.MESSAGING_API_URL}?fields=verified_name`, {
        headers: { Authorization: `Bearer ${env.MESSAGING_API_TOKEN}` },
      });
      if (!res.ok) {
        return { status: "ERROR", error: `HTTP ${res.status}` };
      }
      return { status: "CONNECTED" };
    } catch (err: any) {
      return { status: "ERROR", error: err.message };
    }
  }

  async disconnectInstance(_instanceId: string): Promise<void> {
    return;
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<SendResult> {
    this.assertConfigured();
    try {
      const res = await fetch(`${env.MESSAGING_API_URL}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.MESSAGING_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: params.to,
          type: "text",
          text: { body: params.text },
        }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        return { providerMessageId: "", status: "FAILED", error: JSON.stringify(data) };
      }
      return { providerMessageId: data?.messages?.[0]?.id ?? "", status: "SENT" };
    } catch (err: any) {
      return { providerMessageId: "", status: "FAILED", error: err.message };
    }
  }

  async sendGroupInvite(params: SendGroupInviteParams): Promise<SendResult> {
    return this.sendTextMessage({
      instanceId: params.instanceId,
      to: params.to,
      text: `Você foi convidado para nossa comunidade: ${params.inviteLink}`,
      idempotencyKey: `invite_${params.to}_${params.inviteLink}`,
    });
  }

  async joinGroup(_params: JoinGroupParams): Promise<JoinGroupResult> {
    // A Cloud API oficial não tem nenhum endpoint para entrar em grupos via
    // link de convite - isso só existe no protocolo não documentado que o
    // WhatsApp Web (e o Baileys) usa. A tela de Grupos só oferece "Entrar
    // com todos os números" para instâncias WHATSAPP_QR (ver
    // groups.service.ts joinAll), então este método não deveria ser
    // chamado na prática - existe só para cumprir a interface.
    return { status: "FAILED", error: "Entrar em grupos por link não é suportado pela API oficial (Cloud API)." };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected =
      "sha256=" + crypto.createHmac("sha256", env.WEBHOOK_SECRET).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}
