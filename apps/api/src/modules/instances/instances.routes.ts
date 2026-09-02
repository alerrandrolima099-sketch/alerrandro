import { Router } from "express";
import { z } from "zod";
import { instancesService } from "./instances.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const instancesRouter = Router();
instancesRouter.use(requireAuth, resolveTenant);

instancesRouter.get("/", async (req, res, next) => {
  try {
    res.json(await instancesService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

instancesRouter.get("/:id", async (req, res, next) => {
  try {
    res.json(await instancesService.getById(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(2),
  provider: z.enum(["MOCK", "WHATSAPP_CLOUD_API", "WHATSAPP_QR"]).optional(),
  providerConfig: z.record(z.unknown()).optional(),
});

instancesRouter.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    res.status(201).json(await instancesService.create(req.tenantId!, body));
  } catch (err) {
    next(err);
  }
});

instancesRouter.post("/:id/connect", async (req, res, next) => {
  try {
    res.json(await instancesService.connect(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

instancesRouter.post("/:id/disconnect", async (req, res, next) => {
  try {
    res.json(await instancesService.disconnect(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

const updateAiSettingsSchema = z.object({
  aiAutoReplyEnabled: z.boolean().optional(),
  aiSystemPrompt: z.string().max(4000).nullable().optional(),
  // Perfil de Conversa (seção 38) reutilizável - quando aiSystemPrompt está
  // preenchido, ele continua tendo prioridade sobre o Perfil selecionado.
  personaId: z.string().nullable().optional(),
});

instancesRouter.patch("/:id/ai-settings", async (req, res, next) => {
  try {
    const body = updateAiSettingsSchema.parse(req.body);
    res.json(await instancesService.updateAiSettings(req.tenantId!, req.params.id, body));
  } catch (err) {
    next(err);
  }
});

instancesRouter.post("/:id/pause", async (req, res, next) => {
  try {
    res.json(await instancesService.pause(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

instancesRouter.delete("/:id", async (req, res, next) => {
  try {
    await instancesService.remove(req.tenantId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
