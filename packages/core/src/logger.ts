import { prisma } from "@whatsapp-saas/database";

// Logger de auditoria - grava em tabela Log (seção 16).
// IMPORTANTE: nunca passar tokens/secrets em `metadata`.
export async function writeLog(params: {
  tenantId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.log.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? undefined,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? undefined,
        metadata: params.metadata as any,
        ip: params.ip ?? undefined,
      },
    });
  } catch (err) {
    // Log nunca deve derrubar o fluxo principal da aplicação.
    // eslint-disable-next-line no-console
    console.error("[logger] failed to persist log", err);
  }
}
