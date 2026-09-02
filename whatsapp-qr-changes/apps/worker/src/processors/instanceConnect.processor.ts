import { Worker, Job } from "bullmq";
import { redisConnection, getBaileysProvider } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
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
 */
export function registerInstanceConnectProcessor() {
  const worker = new Worker<InstanceConnectJobData>(
    QUEUE_NAMES.INSTANCE_CONNECT,
    async (job: Job<InstanceConnectJobData>) => {
      const { instanceId } = job.data;
      const provider = getBaileysProvider();
      const result = await provider.connectInstance(instanceId);

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

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[instanceConnect.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Ao subir o worker, retoma automaticamente qualquer instância WHATSAPP_QR
 * que já tinha uma sessão persistida (evita pedir escaneio de QR Code de
 * novo a cada deploy/restart do worker).
 */
export async function resumeQrInstancesOnStartup() {
  const instances = await prisma.instance.findMany({
    where: { provider: "WHATSAPP_QR", status: { in: ["CONNECTED", "CONNECTING"] } },
    select: { id: true },
  });
  if (instances.length === 0) return;

  const provider = getBaileysProvider();
  await provider.resumeAllSessions(instances.map((i) => i.id));
}
