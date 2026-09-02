import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";

/**
 * Perfis de Conversa (seção 38) - persona de IA reutilizável entre
 * instâncias. Instance.aiSystemPrompt (texto livre por instância) continua
 * existindo e tem prioridade quando preenchido - isso aqui só dá uma forma
 * reaproveitável de configurar o "tom" padrão, sem precisar redigitar o
 * mesmo texto em cada número.
 */
export class PersonasService {
  async list(tenantId: string) {
    return prisma.persona.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { instances: true } } },
    });
  }

  async create(tenantId: string, params: { name: string; systemPrompt: string }) {
    const persona = await prisma.persona.create({
      data: { tenantId, name: params.name, systemPrompt: params.systemPrompt },
    });
    await writeLog({ tenantId, action: "PERSONA_CREATED", resource: "persona", resourceId: persona.id });
    return persona;
  }

  async update(tenantId: string, id: string, params: { name?: string; systemPrompt?: string }) {
    const existing = await prisma.persona.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Perfil de conversa não encontrado");

    const updated = await prisma.persona.update({
      where: { id },
      data: {
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.systemPrompt !== undefined ? { systemPrompt: params.systemPrompt } : {}),
      },
    });
    await writeLog({ tenantId, action: "PERSONA_UPDATED", resource: "persona", resourceId: id });
    return updated;
  }

  async remove(tenantId: string, id: string) {
    const existing = await prisma.persona.findFirst({ where: { id, tenantId } });
    if (!existing) throw new AppError(404, "Perfil de conversa não encontrado");
    // onDelete: SetNull no relacionamento com Instance - excluir um Perfil
    // nunca quebra a instância que o usava, só volta a usar o prompt padrão.
    await prisma.persona.delete({ where: { id } });
    await writeLog({ tenantId, action: "PERSONA_DELETED", resource: "persona", resourceId: id });
  }
}

export const personasService = new PersonasService();
