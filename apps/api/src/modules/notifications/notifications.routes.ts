import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth, resolveTenant);

notificationsRouter.get("/", async (req, res, next) => {
  try {
    res.json(await prisma.notification.findMany({ where: { tenantId: req.tenantId! }, orderBy: { createdAt: "desc" }, take: 100 }));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post("/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.notification.findFirst({ where: { id: req.params.id, tenantId: req.tenantId! } });
    if (!notification) return res.status(404).json({ statusCode: 404, message: "Notificação não encontrada" });
    res.json(await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } }));
  } catch (err) {
    next(err);
  }
});
