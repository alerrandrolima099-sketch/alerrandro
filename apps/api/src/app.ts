import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "@whatsapp-saas/config";
import { globalRateLimiter } from "./middleware/rateLimit";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";

import { authRouter } from "./modules/auth/auth.routes";
import { instancesRouter } from "./modules/instances/instances.routes";
import { contactsRouter } from "./modules/contacts/contacts.routes";
import { conversationsRouter } from "./modules/conversations/conversations.routes";
import { sessionsRouter } from "./modules/sessions/sessions.routes";
import { automationsRouter } from "./modules/automations/automations.routes";
import { groupsRouter } from "./modules/groups/groups.routes";
import { logsRouter } from "./modules/logs/logs.routes";
import { notificationsRouter } from "./modules/notifications/notifications.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { webhooksRouter } from "./modules/webhooks/webhooks.routes";
import { healthRouter } from "./modules/health/health.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { warmupRouter } from "./modules/warmup/warmup.routes";
import { personasRouter } from "./modules/personas/personas.routes";

export function createApp() {
  const app = express();

  // Segurança (seção 24)
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(globalRateLimiter);
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/instances", instancesRouter);
  app.use("/contacts", contactsRouter);
  app.use("/conversations", conversationsRouter);
  app.use("/sessions", sessionsRouter);
  app.use("/automations", automationsRouter);
  app.use("/groups", groupsRouter);
  app.use("/logs", logsRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/admin", adminRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/warmup-pairs", warmupRouter);
  app.use("/personas", personasRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
