import { Router } from "express";
import { z } from "zod";
import { contactsService } from "./contacts.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const contactsRouter = Router();
contactsRouter.use(requireAuth, resolveTenant);

contactsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await contactsService.list(req.tenantId!, { status: req.query.status as string, tag: req.query.tag as string }));
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
  email: z.string().email().optional(),
  origin: z.string().optional(),
  consentSource: z.enum(["FORM", "IMPORT", "MANUAL", "WEBHOOK", "API"]),
});

contactsRouter.post("/", async (req, res, next) => {
  try {
    res.status(201).json(await contactsService.create(req.tenantId!, createSchema.parse(req.body)));
  } catch (err) {
    next(err);
  }
});

contactsRouter.post("/:id/tags", async (req, res, next) => {
  try {
    const { tag } = z.object({ tag: z.string() }).parse(req.body);
    res.json(await contactsService.tag(req.tenantId!, req.params.id, tag));
  } catch (err) {
    next(err);
  }
});

contactsRouter.delete("/:id/tags/:tag", async (req, res, next) => {
  try {
    res.json(await contactsService.untag(req.tenantId!, req.params.id, req.params.tag));
  } catch (err) {
    next(err);
  }
});

// Botão "Remover meu contato" / opt-out (seção 9)
contactsRouter.post("/:id/opt-out", async (req, res, next) => {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body ?? {});
    await contactsService.optOut(req.tenantId!, req.params.id, note);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// LGPD (seção 25)
contactsRouter.delete("/:id/data", async (req, res, next) => {
  try {
    await contactsService.deleteContactData(req.tenantId!, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

contactsRouter.get("/:id/export", async (req, res, next) => {
  try {
    res.json(await contactsService.exportContactData(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});
