import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { getMessagingProvider } from "../../messaging";
import { enqueueWebhookProcess } from "../../queues/queueService";
import crypto from "crypto";

export const webhooksRouter = Router();

/**
 * POST /webhooks/messaging (seção 13)
 * - Valida assinatura do provedor quando disponível.
 * - Nunca confia cegamente no payload.
 * - Idempotência: idempotencyKey = hash do payload bruto, com UNIQUE no banco;
 *   se já existir, o evento é ignorado (evita reprocessar o mesmo evento).
 */
webhooksRouter.post("/messaging", async (req, res, next) => {
  try {
    const provider = getMessagingProvider();
    const rawBody = JSON.stringify(req.body);
    const signature = req.header("x-hub-signature-256") ?? req.header("x-signature");

    const validSignature = provider.verifyWebhookSignature(rawBody, signature ?? undefined);
    if (!validSignature) {
      return res.status(401).json({ statusCode: 401, message: "Assinatura de webhook inválida" });
    }

    const idempotencyKey = crypto.createHash("sha256").update(rawBody).digest("hex");

    const existing = await prisma.webhookEvent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      // Evento duplicado - responde 200 sem reprocessar (idempotência).
      return res.status(200).json({ status: "duplicate_ignored" });
    }

    const eventType = req.body?.eventType ?? req.body?.type ?? "unknown";

    const event = await prisma.webhookEvent.create({
      data: {
        provider: provider.name as any,
        eventType,
        idempotencyKey,
        payload: req.body,
        status: "PENDING",
      },
    });

    await enqueueWebhookProcess({ webhookEventId: event.id });

    res.status(202).json({ status: "accepted", eventId: event.id });
  } catch (err) {
    next(err);
  }
});
