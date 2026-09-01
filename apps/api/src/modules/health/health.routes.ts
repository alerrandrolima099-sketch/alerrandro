import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { redisConnection } from "../../lib/redis";

export const healthRouter = Router();

/** GET /health (seção 30) - status da API, banco e Redis. */
healthRouter.get("/", async (_req, res) => {
  const result: Record<string, string> = { api: "ok" };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = "ok";
  } catch {
    result.database = "error";
  }

  try {
    const pong = await redisConnection.ping();
    result.redis = pong === "PONG" ? "ok" : "error";
  } catch {
    result.redis = "error";
  }

  const healthy = Object.values(result).every((v) => v === "ok");
  res.status(healthy ? 200 : 503).json({ status: healthy ? "healthy" : "degraded", checks: result });
});
