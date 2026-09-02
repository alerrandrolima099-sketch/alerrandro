import { Router } from "express";
import { z } from "zod";
import { personasService } from "./personas.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const personasRouter = Router();
personasRouter.use(requireAuth, resolveTenant);

personasRouter.get("/", async (req, res, next) => {
  try {
    res.json(await personasService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(2),
  systemPrompt: z.string().min(1).max(4000),
});

personasRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    res.status(201).json(await personasService.create(req.tenantId!, body));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  systemPrompt: z.string().min(1).max(4000).optional(),
});

personasRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    res.json(await personasService.update(req.tenantId!, req.params.id, body));
  } catch (err) {
    next(err);
  }
});

personasRouter.delete("/:id", async (req, res, next) => {
  try {
    await personasService.remove(req.tenantId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
