import { Router } from "express";
import { z } from "zod";
import { automationsService } from "./automations.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const automationsRouter = Router();
automationsRouter.use(requireAuth, resolveTenant);

automationsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await automationsService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

automationsRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await automationsService.getById(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

automationsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
    res.status(201).json(await automationsService.create(req.tenantId!, name));
  } catch (err) {
    next(err);
  }
});

automationsRouter.post("/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]) }).parse(req.body);
    res.json(await automationsService.setStatus(req.tenantId!, req.params.id, status));
  } catch (err) {
    next(err);
  }
});

const nodeSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["START", "SEND_MESSAGE", "WAIT", "WAIT_FOR_REPLY", "CONDITION", "TAG_CONTACT", "REMOVE_TAG", "TRANSFER", "END", "SEND_INVITE"]),
  position: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  nextNodeIds: z.array(z.string().uuid()).optional(),
});

automationsRouter.post("/:id/nodes", async (req, res, next) => {
  try {
    res.status(201).json(await automationsService.upsertNode(req.tenantId!, req.params.id, nodeSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

automationsRouter.delete("/:id/nodes/:nodeId", async (req, res, next) => {
  try {
    await automationsService.deleteNode(req.tenantId!, req.params.id, req.params.nodeId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
