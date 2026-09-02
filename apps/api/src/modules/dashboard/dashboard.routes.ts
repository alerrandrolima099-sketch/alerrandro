import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { requireAuth } from "../../middleware/auth.middleware";
import { resolveTenant } from "../../middleware/tenant.middleware";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, resolveTenant);

/** Indicadores do dashboard (seção 5). */
dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const [
      totalInstances,
      connectedInstances,
      disconnectedInstances,
      errorInstances,
      activeSessions,
      completedSessions,
      messagesProcessed,
      messagesPending,
      invitesSent,
      invitesAccepted,
      activeContacts,
      activeAutomations,
    ] = await Promise.all([
      prisma.instance.count({ where: { tenantId } }),
      prisma.instance.count({ where: { tenantId, status: "CONNECTED" } }),
      prisma.instance.count({ where: { tenantId, status: "DISCONNECTED" } }),
      prisma.instance.count({ where: { tenantId, status: "ERROR" } }),
      prisma.session.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.session.count({ where: { tenantId, status: "COMPLETED" } }),
      prisma.message.count({ where: { instance: { tenantId }, status: { in: ["SENT", "DELIVERED", "READ"] } } }),
      prisma.message.count({ where: { instance: { tenantId }, status: "QUEUED" } }),
      prisma.invite.count({ where: { event: "INVITE_SENT", contact: { tenantId } } }),
      prisma.invite.count({ where: { event: "INVITE_ACCEPTED", contact: { tenantId } } }),
      prisma.contact.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.automation.count({ where: { tenantId, status: "ACTIVE" } }),
    ]);

    res.json({
      totalInstances,
      connectedInstances,
      disconnectedInstances,
      errorInstances,
      activeSessions,
      completedSessions,
      messagesProcessed,
      messagesPending,
      invitesSent,
      invitesAccepted,
      activeContacts,
      activeAutomations,
    });
  } catch (err) {
    next(err);
  }
});

/** Série temporal simples para gráficos (mensagens por dia, últimos 14 dias). */
dashboardRouter.get("/messages-timeseries", async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;
    const since = new Date();
    since.setDate(since.getDate() - 14);

    const messages = await prisma.message.findMany({
      where: { instance: { tenantId }, createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const buckets: Record<string, number> = {};
    for (const m of messages) {
      const day = m.createdAt.toISOString().slice(0, 10);
      buckets[day] = (buckets[day] ?? 0) + 1;
    }

    res.json(Object.entries(buckets).map(([date, count]) => ({ date, count })));
  } catch (err) {
    next(err);
  }
});
