import { env } from "@whatsapp-saas/config";
import { registerMessageProcessor } from "./processors/message.processor";
import { registerSessionProcessor } from "./processors/session.processor";
import { registerAutomationProcessor } from "./processors/automation.processor";
import { registerWebhookProcessor } from "./processors/webhook.processor";
import { registerNotificationProcessor } from "./processors/notification.processor";

/**
 * Entry point do worker (seção 12/apps/worker).
 * Cada processor abre seu próprio BullMQ Worker consumindo uma fila
 * dedicada. Rodar múltiplas réplicas deste processo escala horizontalmente
 * sem nenhuma mudança de código (seção 33).
 */
async function main() {
  // eslint-disable-next-line no-console
  console.log(`[worker] starting (env=${env.NODE_ENV}, provider=${env.MESSAGING_PROVIDER})`);

  registerMessageProcessor();
  registerSessionProcessor();
  registerAutomationProcessor();
  registerWebhookProcessor();
  registerNotificationProcessor();

  // eslint-disable-next-line no-console
  console.log("[worker] all processors registered, waiting for jobs...");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[worker] fatal error on startup", err);
  process.exit(1);
});

process.on("SIGTERM", () => {
  // eslint-disable-next-line no-console
  console.log("[worker] SIGTERM received, shutting down gracefully");
  process.exit(0);
});
