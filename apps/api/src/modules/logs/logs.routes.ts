import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const logsRouter = Router();
logsRouter.use(requireAuth, resolveTenant);

logsRouter.get("/", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);
    const [data, total] = await Promise.all([
      prisma.log.findMany({
        where: { tenantId: req.tenantId! },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.log.count({ where: { tenantId: req.tenantId! } }),
    ]);
    res.json({ data, page, pageSize, total });
  } catch (err) {
    next(err);
  }
});
