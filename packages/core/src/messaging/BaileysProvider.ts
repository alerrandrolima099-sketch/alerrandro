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
import { handleInboundMessage } from "../inbound/handleInboundMessage";

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

  async connectInstance(instanceId: string, opts: { fresh?: boolean } = {}): Promise<ConnectInstanceResult> {
    const existingSocket = this.sockets.get(instanceId);
    if (existingSocket) {
      return { status: "CONNECTED" };
    }

    const inFlight = this.connecting.get(instanceId);
    if (inFlight) return inFlight;

    const promise = this.startSocket(instanceId, opts.fresh ?? false);
    this.connecting.set(instanceId, promise);
    try {
      return await promise;
    } finally {
      this.connecting.delete(instanceId);
    }
  }

  private async startSocket(instanceId: string, fresh = false): Promise<ConnectInstanceResult> {
    // eslint-disable-next-line no-console
    console.log(`[BaileysProvider] startSocket instanceId=${instanceId} fresh=${fresh}`);

    if (fresh) {
      // "fresh" só é true quando este connectInstance() veio de um clique
      // explícito do usuário em "Conectar" (via fila instanceConnectQueue -
      // ver apps/worker/src/processors/instanceConnect.processor.ts).
      // Descartamos qualquer sessão anterior aqui de propósito: se o worker
      // reiniciou (deploy, crash) no meio de um pareamento anterior que
      // nunca terminou, os arquivos do useMultiFileAuthState ficam parciais/
      // inconsistentes - reaproveitá-los faz o handshake do Baileys travar
      // pra sempre (sem nunca emitir "qr" nem fechar a conexão com erro),
      // deixando a tela do usuário presa em "Gerando QR Code..." mesmo com
      // o timeout de 45s abaixo, já que esse timeout só protege ESTA
      // chamada - não impede um pareamento igualmente travado de começar de
      // novo na próxima tentativa se a sessão corrompida continuar em disco.
      try {
        fs.rmSync(this.sessionDir(instanceId), { recursive: true, force: true });
      } catch {
        /* melhor esforço */
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir(instanceId));
    // eslint-disable-next-line no-console
    console.log(`[BaileysProvider] auth state carregado para ${instanceId}, abrindo socket...`);

    return new Promise<ConnectInstanceResult>((resolve) => {
      let settled = false;
      const settleOnce: PendingResolver = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimeout);
        resolve(result);
      };

      // Trava de segurança: se em ~45s o WhatsApp não responder nem com um
      // QR Code nem com a conexão aberta (ex: instabilidade de rede entre o
      // servidor e os servidores do WhatsApp, ou algum bloqueio momentâneo
      // do lado deles), desiste e marca ERROR em vez de deixar a tela do
      // usuário "Gerando QR Code..." carregando para sempre sem explicação.
      const handshakeTimeout = setTimeout(async () => {
        if (settled) return;
        try {
          await prisma.instance.update({
            where: { id: instanceId },
            data: {
              status: "ERROR",
              lastError: "Tempo esgotado aguardando resposta do WhatsApp. Tente conectar novamente em alguns minutos.",
            },
          });
        } catch {
          /* melhor esforço - não deixa isso derrubar o processo */
        }
        try {
          (sock as any).end?.(undefined);
        } catch {
          /* socket pode já estar em estado inválido - ignora */
        }
        this.sockets.delete(instanceId);
        settleOnce({ status: "ERROR", error: "handshake_timeout" });
      }, 45_000);

      const sock = makeWASocket({
        auth: state,
        logger: logger as any,
        printQRInTerminal: false,
      });

      sock.ev.on("creds.update", saveCreds);

      // Mensagens recebidas de contatos (seção 34): único jeito de capturar
      // inbound em instâncias WHATSAPP_QR, já que este provedor não usa
      // webhooks HTTP do Meta - tudo chega por eventos do próprio socket.
      // Alimenta o mesmo pipeline (handleInboundMessage) usado pelo webhook
      // da Cloud API, então automação e resposta automática por IA
      // funcionam igual nos dois provedores.
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
          try {
            if (msg.key.fromMe) continue; // ignora eco das próprias mensagens enviadas

            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid.endsWith("@g.us")) continue; // grupos não são tratados por enquanto

            const text =
              msg.message?.conversation ??
              msg.message?.extendedTextMessage?.text ??
              msg.message?.imageMessage?.caption ??
              msg.message?.videoMessage?.caption ??
              null;
            if (!text) continue; // ignora mídia sem legenda, reações, etc.

            const from = remoteJid.split("@")[0];
            await handleInboundMessage({
              instanceId,
              from,
              text,
              providerMsgId: msg.key.id ?? undefined,
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[BaileysProvider] falha ao processar mensagem recebida (instância ${instanceId}):`, err);
          }
        }
      });

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        // eslint-disable-next-line no-console
        console.log(
          `[BaileysProvider] connection.update instanceId=${instanceId} connection=${connection ?? "-"} qr=${qr ? "yes" : "no"}`
        );

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            await prisma.instance.update({
              where: { id: instanceId },
              data: { status: "CONNECTING", qrCode: qrDataUrl, lastError: null },
            });
            settleOnce({ status: "CONNECTING", qrCode: qrDataUrl });
          } catch (err: any) {
            // Se o update falhar (ex: a instância foi removida do banco
            // enquanto este job ficava na fila - pode acontecer com jobs
            // antigos que ficaram represados por horas antes de uma
            // correção de bug), a instância é órfã: não faz sentido manter
            // esse socket vivo. Sem fechar aqui, o WhatsApp continua girando
            // um QR Code novo a cada ~20s pra sempre (protocolo padrão de
            // renovação de QR), e cada renovação tentava gravar no banco de
            // novo, repetindo esse mesmo erro indefinidamente até o
            // processo reiniciar.
            // eslint-disable-next-line no-console
            console.error(`[BaileysProvider] falha ao salvar QR Code (instância ${instanceId}), encerrando socket órfão:`, err.message);
            try {
              (sock as any).end?.(undefined);
            } catch {
              /* ignora */
            }
            this.sockets.delete(instanceId);
            settleOnce({ status: "ERROR", error: err.message });
          }
        }

        if (connection === "open") {
          this.sockets.set(instanceId, sock);
          this.restartAttempts.delete(instanceId);
          const phoneNumber = sock.user?.id?.split(":")[0]?.split("@")[0] ?? null;

          // Foto de perfil do próprio número (seção 36) - melhor esforço:
          // nem todo número tem uma definida, e às vezes a privacidade do
          // WhatsApp bloqueia a busca. Nunca deixa isso derrubar a conexão.
          let profilePicUrl: string | null = null;
          try {
            if (sock.user?.id) {
              profilePicUrl = (await sock.profilePictureUrl(sock.user.id, "image")) ?? null;
            }
          } catch {
            profilePicUrl = null;
          }

          await prisma.instance.update({
            where: { id: instanceId },
            data: {
              status: "CONNECTED",
              qrCode: null,
              lastError: null,
              ...(phoneNumber ? { phoneNumber } : {}),
              ...(profilePicUrl ? { profilePicUrl } : {}),
            },
          });
          settleOnce({ status: "CONNECTED" });
        }

        if (connection === "close") {
          this.sockets.delete(instanceId);
          const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
          // eslint-disable-next-line no-console
          console.log(`[BaileysProvider] conexão fechada instanceId=${instanceId} statusCode=${statusCode ?? "desconhecido"}`);

          const loggedOut = statusCode === DisconnectReason.loggedOut;

          // Qualquer motivo de queda que NÃO seja logout (rede instável entre
          // o servidor e o WhatsApp, o próprio WhatsApp reiniciando a sessão,
          // o código 515/restartRequired que acontece de propósito logo após
          // escanear o QR, etc.) - tenta reconectar sozinho antes de desistir.
          // Isso é importante porque quem está atendendo pelo Conversas não
          // fica olhando a tela de Instâncias o tempo todo: sem isso, uma
          // queda momentânea deixava o número "conectado" na tela mas incapaz
          // de enviar/receber até alguém notar e clicar em Conectar de novo -
          // foi exatamente o que causou mensagens que pareciam enviadas no
          // Conversas mas nunca chegavam no WhatsApp do cliente.
          if (!loggedOut) {
            const attempts = (this.restartAttempts.get(instanceId) ?? 0) + 1;
            this.restartAttempts.set(instanceId, attempts);
            if (attempts <= 5) {
              const isRestartRequired = statusCode === DisconnectReason.restartRequired;
              const retry = () =>
                this.startSocket(instanceId, false).catch(() => {
                  /* erros da nova tentativa já são gravados no banco */
                });
              if (isRestartRequired) {
                retry();
              } else {
                // Motivos diferentes de 515 não são "o fluxo normal esperado"
                // - dá uma pequena folga antes de tentar de novo, pra não
                // martelar o servidor do WhatsApp em loop apertado se ele
                // estiver realmente recusando a conexão por algum tempo.
                setTimeout(retry, 3_000);
              }
              return;
            }
            // Muitas tentativas seguidas sem sucesso - desiste e reporta erro
            // em vez de ficar reconectando pra sempre.
          }

          if (loggedOut) {
            // Sessão invalidada (logout pelo celular) - limpa credenciais para
            // forçar um novo QR Code na próxima tentativa de conexão.
            fs.rmSync(this.sessionDir(instanceId), { recursive: true, force: true });
            await prisma.instance.update({
              where: { id: instanceId },
              data: {
                status: "DISCONNECTED",
                qrCode: null,
                profilePicUrl: null,
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

      // Trava de segurança: em alguns casos o socket fica "aberto" do nosso
      // lado (connection.update nunca disparou "close") mas o envio nunca
      // recebe resposta do WhatsApp - sock.sendMessage() fica pendurado pra
      // sempre. Sem um limite aqui, o job na fila travava por mais de um
      // minuto até o BullMQ desistir sozinho com "Timed Out", sem nenhuma
      // mensagem de erro útil pro atendente. Depois desse tempo, tratamos o
      // socket como morto (zumbi): derruba de propósito para que o handler
      // de "close" (com a reconexão automática) entre em ação.
      const sent = await Promise.race([
        sock.sendMessage(jid, { text: params.text }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("send_timeout")), 20_000)
        ),
      ]);
      return { providerMessageId: sent?.key?.id ?? "", status: "SENT" };
    } catch (err: any) {
      if (err?.message === "send_timeout") {
        // eslint-disable-next-line no-console
        console.error(`[BaileysProvider] envio travou por 20s (instância ${params.instanceId}) - socket tratado como morto, forçando reconexão`);
        this.sockets.delete(params.instanceId);
        try {
          (sock as any).end?.(undefined);
        } catch {
          /* ignora */
        }
        return {
          providerMessageId: "",
          status: "FAILED",
          error: "O WhatsApp não confirmou o envio a tempo. A instância será reconectada automaticamente - tente enviar de novo em alguns segundos.",
        };
      }
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
    // WHATSAPP_QR não usa webhooks do Meta - mensagens chegam por eventos
    // do próprio socket, não por HTTP. Não aplicável.
    return false;
  }
}
