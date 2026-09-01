import { Worker, Job } from "bullmq";
import { redisConnection, senderPoolService, automationEngine } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { SessionAdvanceJobData } from "@whatsapp-saas/types";

/**
 * Consome sessionQueue: quando o tempo configurado (stepDurationSec) expira,
 * avança a sessão para a próxima etapa do fluxo (seção 8).
 *
 * Se a sessão já tiver uma AutomationExecution ativa, delega ao
 * AutomationEngine. Sessões sem automação vinculada apenas são finalizadas.
 */
export function registerSessionProcessor() {
  const worker = new Worker<SessionAdvanceJobData>(
    QUEUE_NAMES.SESSION,
    async (job: Job<SessionAdvanceJobData>) => {
      const session = await prisma.session.findUnique({
        where: { id: job.data.sessionId },
        include: { executions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

      if (!session || session.status !== "ACTIVE") {
        return { skipped: true };
      }

      const latestExecution = session.executions[0];
      if (latestExecution && latestExecution.status === "RUNNING") {
        await automationEngine.processStep(latestExecution.id);
        return { advanced: true, executionId: latestExecution.id };
      }

      // Sem automação em execução - apenas finaliza a sessão e libera o sender.
      if (session.senderId) {
        // O lock token não é persistido por design (é efêmero); em caso de
        // expiração natural do TTL do lock, apenas normalizamos o status do sender.
        await prisma.sender.update({ where: { id: session.senderId }, data: { status: "AVAILABLE" } }).catch(() => undefined);
      }

      await prisma.session.update({ where: { id: session.id }, data: { status: "COMPLETED", endedAt: new Date() } });
      return { completed: true };
    },
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[session.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
