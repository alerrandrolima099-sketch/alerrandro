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

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  inviteLink: z.string().url().optional(),
  category: z.string().optional(),
});

// Editar/excluir (seção 41 - menu "⋯") só é permitido para grupos PRIVADOS
// deste tenant - groupsService.update/remove já garante isso internamente
// (grupos do catálogo global e de outros tenants respondem 404 aqui).
groupsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateSchema.parse(req.body);
    res.json(await groupsService.update(req.tenantId!, req.params.id, body));
  } catch (err) {
    next(err);
  }
});

groupsRouter.delete("/:id", async (req, res, next) => {
  try {
    await groupsService.remove(req.tenantId!, req.params.id);
    res.status(204).send();
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

const joinAllSchema = z.object({ instanceIds: z.array(z.string().uuid()).optional() });

groupsRouter.post("/:id/join-all", async (req, res, next) => {
  try {
    // req.body pode vir vazio ({} ou undefined) quando o front pede "entrar
    // com todas" - z.object({...}).optional() em cada campo já cobre isso,
    // só precisamos aceitar um corpo ausente sem quebrar o parse.
    const { instanceIds } = joinAllSchema.parse(req.body ?? {});
    res.status(201).json(await groupsService.joinAll(req.tenantId!, req.params.id, instanceIds));
  } catch (err) {
    next(err);
  }
});

groupsRouter.get("/:id/joins", async (req, res, next) => {
  try {
    res.json(await groupsService.listJoins(req.tenantId!, req.params.id));
  } catch (err) {
    next(err);
  }
});
