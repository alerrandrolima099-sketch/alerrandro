import { Worker, Job } from "bullmq";
import fs from "fs";
import path from "path";
import { redisConnection, getBaileysProvider } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { env } from "@whatsapp-saas/config";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { InstanceConnectJobData } from "@whatsapp-saas/types";

/**
 * Consome instanceConnectQueue: abre (ou retoma) a sessão Baileys de uma
 * instância WHATSAPP_QR. Roda concurrency: 1 de propósito - abrir vários
 * sockets simultâneos concorrendo por I/O de disco na mesma sessão poderia
 * corromper os arquivos de credenciais do useMultiFileAuthState.
 *
 * O resultado real da conexão (QR Code gerado, CONNECTED, ERROR) é gravado
 * diretamente no banco (Instance.qrCode/status) de dentro do
 * BaileysProvider - este processor só precisa disparar connectInstance() e
 * deixar o job terminar; o front-end descobre o resultado via polling em
 * GET /instances/:id.
 *
 * fresh: true é proposital aqui - todo job desta fila vem de um clique
 * explícito do usuário em "Conectar" pela UI (via API -> enqueueInstance-
 * Connect), então é sempre seguro (e necessário) descartar qualquer sessão
 * anterior incompleta antes de tentar de novo. Ver o comentário longo em
 * BaileysProvider.startSocket e em resumeQrInstancesOnStartup logo abaixo
 * para o motivo: sem isso, uma sessão parcial deixada por um restart do
 * worker no meio de um pareamento anterior podia travar o handshake do
 * Baileys pra sempre, sem nunca gerar QR Code nem disparar erro.
 */
export function registerInstanceConnectProcessor() {
  const worker = new Worker<InstanceConnectJobData>(
    QUEUE_NAMES.INSTANCE_CONNECT,
    async (job: Job<InstanceConnectJobData>) => {
      const { instanceId, phoneNumber } = job.data;
      // eslint-disable-next-line no-console
      console.log(
        `[instanceConnect.processor] job ${job.id} iniciado para instância ${instanceId}${phoneNumber ? " (código de pareamento)" : ""}`
      );

      const provider = getBaileysProvider();
      const result = await provider.connectInstance(instanceId, { fresh: true, phoneNumber });

      // eslint-disable-next-line no-console
      console.log(`[instanceConnect.processor] job ${job.id} concluído para instância ${instanceId}: ${result.status}`);

      if (result.status === "ERROR") {
        // Não relança erro (attempts:1 nesta fila) - a instância já foi
        // marcada como ERROR/DISCONNECTED no banco pelo próprio provider,
        // e o usuário pode tentar reconectar manualmente pela UI.
        return { instanceId, status: result.status, error: result.error };
      }

      return { instanceId, status: result.status };
    },
    { connection: redisConnection, concurrency: 1 }
  );

  worker.on("active", (job) => {
    // eslint-disable-next-line no-console
    console.log(`[instanceConnect.processor] job ${job.id} pego pelo worker (instância ${job.data.instanceId})`);
  });

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[instanceConnect.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Ao subir o worker, retoma automaticamente qualquer instância WHATSAPP_QR
 * que já estava CONECTADA (sessão completa e pareada) - evita pedir
 * escaneio de QR Code de novo a cada deploy/restart do worker.
 *
 * Importante (correção de bug): esta função ANTES também tentava retomar
 * instâncias em status "CONNECTING". Isso está errado - CONNECTING
 * significa que um pareamento estava em andamento (aguardando o usuário
 * escanear o QR) quando o processo caiu ou foi reiniciado, e a sessão salva
 * em disco para ela está incompleta por definição (o pareamento nunca
 * terminou de verdade). Tentar reconectar isso automaticamente aqui, por
 * trás e em silêncio, competia com o clique manual do usuário em
 * "Conectar" (que passa pela fila) pelo mesmo slot de conexão em memória
 * (BaileysProvider.connecting) - e como o handshake com uma sessão parcial
 * pode travar pra sempre sem nunca emitir QR nem erro, isso deixava a
 * instância presa em "Gerando QR Code..." indefinidamente, inclusive
 * sobrevivendo a vários restarts do worker (cada boot tentava de novo a
 * mesma sessão corrompida).
 *
 * Agora: só CONNECTED é retomado. Qualquer instância encontrada em
 * CONNECTING neste momento é tratada como órfã/travada - marcamos como
 * ERROR com uma mensagem clara e apagamos a sessão em disco, para que o
 * próximo clique em "Conectar" do usuário comece um pareamento 100% limpo
 * (ver fresh:true acima).
 */
export async function resumeQrInstancesOnStartup() {
  const stuckConnecting = await prisma.instance.findMany({
    where: { provider: "WHATSAPP_QR", status: "CONNECTING" },
    select: { id: true },
  });

  for (const { id: instanceId } of stuckConnecting) {
    try {
      fs.rmSync(path.join(env.BAILEYS_SESSIONS_DIR, instanceId), { recursive: true, force: true });
    } catch {
      /* melhor esforço - não deixa isso derrubar o boot do worker */
    }
    try {
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: "ERROR",
          qrCode: null,
          lastError: "Conexão interrompida por um reinício do servidor. Clique em Conectar para tentar novamente.",
        },
      });
      // eslint-disable-next-line no-console
      console.log(`[instanceConnect.processor] instância ${instanceId} estava travada em CONNECTING no boot - resetada para ERROR`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[instanceConnect.processor] falha ao resetar instância travada ${instanceId}:`, err);
    }
  }

  const connected = await prisma.instance.findMany({
    where: { provider: "WHATSAPP_QR", status: "CONNECTED" },
    select: { id: true },
  });
  if (connected.length === 0) return;

  const provider = getBaileysProvider();
  await provider.resumeAllSessions(connected.map((i) => i.id));
}
