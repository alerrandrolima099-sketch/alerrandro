import { Router } from "express";
import { z } from "zod";
import { warmupService } from "./warmup.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const warmupRouter = Router();
warmupRouter.use(requireAuth, resolveTenant);

warmupRouter.get("/", async (req, res, next) => {
  try {
    res.json(await warmupService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  instanceAId: z.string().min(1),
  instanceBId: z.string().min(1),
  dailyMessageTarget: z.number().int().min(1).max(200).optional(),
  minIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  maxIntervalMinutes: z.number().int().min(1).max(1440).optional(),
});

warmupRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    res.status(201).json(await warmupService.create(req.tenantId!, body));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  dailyMessageTarget: z.number().int().min(1).max(200).optional(),
  minIntervalMinutes: z.number().int().min(1).max(1440).optional(),
  maxIntervalMinutes: z.number().int().min(1).max(1440).optional(),
});

warmupRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    res.json(await warmupService.update(req.tenantId!, req.params.id, body));
  } catch (err) {
    next(err);
  }
});

warmupRouter.get("/:id/messages", async (req, res, next) => {
  try {
    res.json(await warmupService.recentMessages(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

warmupRouter.delete("/:id", async (req, res, next) => {
  try {
    await warmupService.remove(req.tenantId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
