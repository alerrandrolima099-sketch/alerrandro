import { Router } from "express";
import { z } from "zod";
import { sessionsService } from "./sessions.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth, resolveTenant);

sessionsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await sessionsService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

const startSchema = z.object({
  instanceId: z.string().uuid(),
  contactId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  stepDurationSec: z.number().int().positive().optional(),
});

sessionsRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await sessionsService.start(req.tenantId!, startSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

sessionsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    res.json(await sessionsService.cancel(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});
