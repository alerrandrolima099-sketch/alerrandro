import { Router } from "express";
import { z } from "zod";
import { adminService } from "./admin.service";
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
