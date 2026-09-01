import Redis from "ioredis";
import { env } from "@whatsapp-saas/config";

// Conexão única do Redis reutilizada por rate-limit, locks e BullMQ (via connection option).
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // exigido pelo BullMQ
});

redisConnection.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[redis] connection error:", err.message);
});
