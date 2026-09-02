import { Router } from "express";
import { z } from "zod";
import { adminService } from "./admin.service";
import { groupsService } from "../groups/groups.service";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/tenants", async (req, res, next) => {
  try {
    res.json(await adminService.listTenants());
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/tenants", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(2) }).parse(req.body);
    res.status(201).json(await adminService.createTenant(name));
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/tenants/:id/status", async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED"]) }).parse(req.body);
    res.json(await adminService.setTenantStatus(req.params.id, status));
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/metrics", async (req, res, next) => {
  try {
    res.json(await adminService.globalMetrics());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/instances", async (req, res, next) => {
  try {
    res.json(await adminService.listAllInstances());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/senders", async (req, res, next) => {
  try {
    res.json(await adminService.listAllSenders());
  } catch (err) {
    next(err);
  }
});

// Catálogo global de grupos (seção 40) - grupos cadastrados aqui pelo admin
// (tenantId nulo, ver groups.service.ts) aparecem automaticamente para
// TODOS os tenants em GET /groups, que podem usá-los normalmente (oferecer
// convite, "Entrar com todos os números") mas não editar/excluir - isso é
// exclusivo do admin, através destas rotas.
const adminGroupCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  inviteLink: z.string().url(),
  category: z.string().optional(),
});

const adminGroupUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  inviteLink: z.string().url().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

adminRouter.get("/groups", async (req, res, next) => {
  try {
    res.json(await groupsService.adminList());
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/groups", async (req, res, next) => {
  try {
    const body = adminGroupCreateSchema.parse(req.body);
    res.status(201).json(await groupsService.adminCreate(body));
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/groups/:id", async (req, res, next) => {
  try {
    const body = adminGroupUpdateSchema.parse(req.body);
    res.json(await groupsService.adminUpdate(req.params.id, body));
  } catch (err) {
    next(err);
  }
});
