import { Router } from "express";
import { z } from "zod";
import { groupsService } from "./groups.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const groupsRouter = Router();
groupsRouter.use(requireAuth, resolveTenant);

groupsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await groupsService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ name: z.string().min(2), description: z.string().optional(), inviteLink: z.string().url(), category: z.string().optional() });

groupsRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await groupsService.create(req.tenantId!, createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

groupsRouter.post("/:id/offer", async (req, res, next) => {
  try {
    const { contactId } = z.object({ contactId: z.string().uuid() }).parse(req.body);
    await groupsService.offerInvite(req.tenantId!, contactId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

groupsRouter.post("/:id/decision", async (req, res, next) => {
  try {
    const { contactId, accepted } = z.object({ contactId: z.string().uuid(), accepted: z.boolean() }).parse(req.body);
    await groupsService.recordDecision(req.tenantId!, contactId, req.params.id, accepted);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
