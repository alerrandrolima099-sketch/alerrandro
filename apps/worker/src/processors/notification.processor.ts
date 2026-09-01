import { Worker, Job } from "bullmq";
import { redisConnection } from "@whatsapp-saas/core";
import { prisma } from "@whatsapp-saas/database";
import { QUEUE_NAMES } from "@whatsapp-saas/types";
import type { NotificationJobData } from "@whatsapp-saas/types";

/** Consome notificationQueue: persiste notificações in-app (seção 17). */
export function registerNotificationProcessor() {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobData>) => {
      const notification = await prisma.notification.create({
        data: {
          tenantId: job.data.tenantId,
          type: job.data.type as any,
          title: job.data.title,
          message: job.data.message,
        },
      });
      return { notificationId: notification.id };
    },
    { connection: redisConnection, concurrency: 20 }
  );

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[notification.processor] job ${job?.id} failed:`, err.message);
  });

  return worker;
}
