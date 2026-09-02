import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import pino from "pino";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import {
  MessagingProvider,
  SendResult,
  SendTextMessageParams,
  ConnectInstanceResult,
  SendGroupInviteParams,
} from "./MessagingProvider";
import { env } from "@whatsapp-saas/config";
import { prisma } from "@whatsapp-saas/database";

/**
 * Adapter NÃO OFICIAL que simula o WhatsApp Web (biblioteca Baileys) para
 * permitir conectar um número de WhatsApp pessoal via leitura de QR Code,
 * sem passar pela WhatsApp Business Cloud API oficial.
 *
 * AVISO IMPORTANTE (repassado ao cliente antes de habilitar esta opção):
 *   - Isto viola os Termos de Serviço do WhatsApp/Meta. O número conectado
 *     corre risco real de ser banido a qualquer momento, sem aviso prévio.
 *   - Não há suporte oficial, SLA, ou garantia de funcionamento contínuo -
 *     a Meta pode quebrar o protocolo não documentado usado pela biblioteca
 *     a qualquer momento.
 *   - Use apenas se você entende e aceita esse risco.
 *
 * Arquitetura: esta classe SÓ deve ser instanciada dentro do processo
 * worker (apps/worker). O socket do Baileys é uma conexão WebSocket viva e
 * stateful - não pode ser compartilhada entre processos/containers
 * diferentes (api e worker rodam em containers separados no Railway).
 * A API nunca chama isto diretamente: ela enfileira um job na
 * instanceConnectQueue e é o worker quem de fato conecta (ver
 * apps/worker/src/processors/instanceConnect.processor.ts).
 *
 * Sessão: as credenciais de pareamento (equivalentes ao "vincular
 * dispositivo" do WhatsApp Web) ficam persistidas em disco, em
 * env.BAILEYS_SESSIONS_DIR/<instanceId>/, via useMultiFileAuthState. Em
 * produção, esse diretório PRECISA estar em um Volume do Railway montado no
 * serviço worker - caso contrário a sessão se perde a cada deploy e o
 * usuário precisa escanear o QR Code novamente toda vez.
 */

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? "silent" });

type PendingResolver = (result: ConnectInstanceResult) => void;

export class BaileysProvider implements MessagingProvider {
  readonly name = "WHATSAPP_QR";

  // Sockets vivos, um por instância - só existem em memória neste processo.
  private sockets = new Map<string, WASocket>();
  // Evita abrir duas conexões simultâneas para a mesma instância.
  private connecting = new Map<string, Promise<ConnectInstanceResult>>();
  // Conta reconexões automáticas seguidas (código 515) por instância, só
  // para evitar um loop infinito caso algo fique preso nesse estado -
  // reseta assim que a conexão realmente abre.
  private restartAttempts = new Map<string, number>();

  private sessionDir(instanceId: string): string {
    const dir = path.join(env.BAILEYS_SESSIONS_DIR, instanceId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  async connectInstance(instanceId: string): Promise<ConnectInstanceResult> {
    const existingSocket = this.sockets.get(instanceId);
    if (existingSocket) {
      return { status: "CONNECTED" };
    }

    const inFlight = this.connecting.get(instanceId);
    if (inFlight) return inFlight;

    const promise = this.startSocket(instanceId);
    this.connecting.set(instanceId, promise);
    try {
      return await promise;
    } finally {
      this.connecting.delete(instanceId);
    }
  }

  private async startSocket(instanceId: string): Promise<ConnectInstanceResult> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir(instanceId));

    return new Promise<ConnectInstanceResult>((resolve) => {
      let settled = false;
      const settleOnce: PendingResolver = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const sock = makeWASocket({
        auth: state,
        logger: logger as any,
        printQRInTerminal: false,
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            await prisma.instance.update({
              where: { id: instanceId },
              data: { status: "CONNECTING", qrCode: qrDataUrl, lastError: null },
            });
            settleOnce({ status: "CONNECTING", qrCode: qrDataUrl });
          } catch (err: any) {
            settleOnce({ status: "ERROR", error: err.message });
          }
        }

        if (connection === "open") {
          this.sockets.set(instanceId, sock);
          this.restartAttempts.delete(instanceId);
          const phoneNumber = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null;
          await prisma.instance.update({
            where: { id: instanceId },
            data: {
              status: "CONNECTED",
              qrCode: null,
              lastError: null,
              ...(phoneNumber ? { phoneNumber } : {}),
            },
          });
          settleOnce({ status: "CONNECTED" });
        }

        if (connection === "close") {
          this.sockets.delete(instanceId);
          const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

          // 515 (restartRequired): o Baileys FECHA a conexão de propósito
          // logo depois que o celular confirma o pareamento (escaneou o QR)
          // e espera que a gente abra um socket novo imediatamente usando as
          // credenciais que acabaram de ser salvas - isso é o fluxo normal,
          // não uma falha. Sem isso o usuário via "erro" mesmo escaneando
          // certinho.
          if (statusCode === DisconnectReason.restartRequired) {
            const attempts = (this.restartAttempts.get(instanceId) ?? 0) + 1;
            this.restartAttempts.set(instanceId, attempts);
            if (attempts <= 5) {
              this.startSocket(instanceId).catch(() => {
                /* erros da nova tentativa já são gravados no banco */
              });
              return;
            }
            // Muitas tentativas seguidas sem sucesso - desiste e reporta erro
            // em vez de ficar reconectando pra sempre.
          }

          const loggedOut = statusCode === DisconnectReason.loggedOut;

          if (loggedOut) {
            // Sessão invalidada (logout pelo celular) - limpa credenciais para
            // forçar um novo QR Code na próxima tentativa de conexão.
            fs.rmSync(this.sessionDir(instanceId), { recursive: true, force: true });
            await prisma.instance.update({
              where: { id: instanceId },
              data: {
                status: "DISCONNECTED",
                qrCode: null,
                lastError: "Sessão desconectada pelo celular (logout).",
              },
            });
          } else {
            await prisma.instance.update({
              where: { id: instanceId },
              data: {
                status: "ERROR",
                lastError: `Conexão perdida (código ${statusCode ?? "desconhecido"}). Tente reconectar.`,
              },
            });
          }

          settleOnce({
            status: "ERROR",
            error: loggedOut ? "logged_out" : `connection_closed_${statusCode ?? "unknown"}`,
          });
        }
      });
    });
  }

  async disconnectInstance(instanceId: string): Promise<void> {
    const sock = this.sockets.get(instanceId);
    this.sockets.delete(instanceId);
    if (sock) {
      try {
        await sock.logout();
      } catch {
        // já pode estar desconectado - ignora.
      }
    }
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: "DISCONNECTED", qrCode: null },
    });
  }

  /**
   * Reconecta automaticamente instâncias WHATSAPP_QR que já tinham sessão
   * salva quando o processo worker sobe (ex: após um deploy/restart) - sem
   * isso, o usuário precisaria escanear o QR Code de novo a cada deploy
   * mesmo com a sessão persistida em disco.
   */
  async resumeAllSessions(instanceIds: string[]): Promise<void> {
    for (const instanceId of instanceIds) {
      const dir = path.join(env.BAILEYS_SESSIONS_DIR, instanceId);
      if (!fs.existsSync(dir)) continue;
      this.connectInstance(instanceId).catch(() => {
        /* erros já são gravados no banco dentro de startSocket */
      });
    }
  }

  async sendTextMessage(params: SendTextMessageParams): Promise<SendResult> {
    const sock = this.sockets.get(params.instanceId);
    if (!sock) {
      return {
        providerMessageId: "",
        status: "FAILED",
        error: "Instância WHATSAPP_QR não está conectada. Reconecte escaneando o QR Code.",
      };
    }
    try {
      const digits = params.to.replace(/\D/g, "");
      const jid = `${digits}@s.whatsapp.net`;
      const sent = await sock.sendMessage(jid, { text: params.text });
      return { providerMessageId: sent?.key?.id ?? "", status: "SENT" };
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

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string | undefined): boolean {
    // WHATSAPP_QR não usa webhooks do Meta - mensagens chegam via evento
    // "messages.upsert" do próprio socket, não por HTTP. Não aplicável.
    return false;
  }
}
