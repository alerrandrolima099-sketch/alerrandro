import { Worker, Job } from "bullmq";
import { redisConnection, automationEngine } from "@whatsapp-saas/core";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { AutomationExecuteJobData } from "@whatsapp-saas/types";

/** Consome automationQueue: interpreta um passo do fluxo via AutomationEngine (seção 10). */
export function registerAutomationProcessor() {
  const worker = new Worker<AutomationExecuteJobData>(
    QUEUE_NAMES.AUTOMATION,
    async (job: Job<AutomationExecuteJobData>) => {
      const result = await automationEngine.processStep(job.data.executionId);
      return { executionId: job.data.executionId, status: result.status };
    },
    { connection: redisConnection, concurrency: 10 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[automation.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
