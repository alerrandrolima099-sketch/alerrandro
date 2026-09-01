import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { senderPoolService } from "../senderPool/senderPool.service";
import { enqueueSessionAdvance } from "../../queues/queueService";
import { env } from "@whatsapp-saas/config";

/**
 * Sessions (seção 8). Uma sessão representa um atendimento em andamento,
 * vinculado a um sender do pool. Ao expirar `stepDurationSec`, o worker
 * (session.processor) avança automaticamente para a próxima etapa do fluxo.
 */
export class SessionsService {
  async list(tenantId: string) {
    return prisma.session.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, include: { contact: true, sender: true } });
  }

  async start(tenantId: string, params: { instanceId: string; contactId: string; conversationId?: string; stepDurationSec?: number }) {
    const acquired = await senderPoolService.acquireSender(tenantId, params.instanceId);
    if (!acquired) {
      throw new AppError(409, "Nenhum número de atendimento disponível no momento");
    }

    const stepDurationSec = params.stepDurationSec ?? env.DEFAULT_SESSION_STEP_DURATION_SEC;

    const session = await prisma.session.create({
      data: {
        tenantId,
        instanceId: params.instanceId,
        senderId: acquired.sender.id,
        contactId: params.contactId,
        conversationId: params.conversationId,
        status: "ACTIVE",
        startedAt: new Date(),
        stepDurationSec,
      },
    });

    // Agenda o avanço automático de etapa após o tempo configurado (seção 8).
    await enqueueSessionAdvance({ sessionId: session.id }, stepDurationSec * 1000);

    return session;
  }

  async finish(tenantId: string, sessionId: string, lockToken: string) {
    const session = await prisma.session.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new AppError(404, "Sessão não encontrada");

    if (session.senderId) {
      await senderPoolService.releaseSender(session.senderId, lockToken);
    }

    return prisma.session.update({
      where: { id: sessionId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
  }

  async cancel(tenantId: string, sessionId: string) {
    const session = await prisma.session.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) throw new AppError(404, "Sessão não encontrada");
    return prisma.session.update({ where: { id: sessionId }, data: { status: "CANCELLED", endedAt: new Date() } });
  }
}

export const sessionsService = new SessionsService();
