import { Router } from "express";
import { z } from "zod";
import { conversationsService } from "./conversations.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth, resolveTenant);

conversationsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await conversationsService.list(req.tenantId!));
  } catch (err) {
    next(err);
  }
});

// Botão "Nova conversa" da tela de Conversas (seção 45).
conversationsRouter.post("/", async (req, res, next) => {
  try {
    const { instanceId, contactId } = z.object({ instanceId: z.string(), contactId: z.string() }).parse(req.body);
    res.status(201).json(await conversationsService.start(req.tenantId!, instanceId, contactId));
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post("/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["AGUARDANDO", "ATENDENDO", "RESOLVIDO"]) }).parse(req.body);
    res.json(await conversationsService.setTicketStatus(req.tenantId!, req.params.id, status));
  } catch (err) {
    next(err);
  }
});

conversationsRouter.get("/:id/messages", async (req, res, next) => {
  try {
    res.json(await conversationsService.getMessages(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post("/:id/messages", async (req, res, next) => {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    res.status(201).json(await conversationsService.sendManualMessage(req.tenantId!, req.params.id, content));
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post("/:id/automation/pause", async (req, res, next) => {
  try {
    res.json(await conversationsService.pauseAutomation(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post("/:id/automation/resume", async (req, res, next) => {
  try {
    res.json(await conversationsService.resumeAutomation(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});
