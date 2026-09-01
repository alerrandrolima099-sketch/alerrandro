import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";

export class AutomationsService {
  async list(tenantId: string) {
    return prisma.automation.findMany({ where: { tenantId }, include: { nodes: true }, orderBy: { createdAt: "desc" } });
  }

  async getById(tenantId: string, id: string) {
    const automation = await prisma.automation.findFirst({ where: { id, tenantId }, include: { nodes: true } });
    if (!automation) throw new AppError(404, "Automação não encontrada");
    return automation;
  }

  async create(tenantId: string, name: string) {
    return prisma.automation.create({ data: { tenantId, name, status: "DRAFT" } });
  }

  async setStatus(tenantId: string, id: string, status: "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED") {
    await this.getById(tenantId, id);
    return prisma.automation.update({ where: { id }, data: { status } });
  }

  async upsertNode(
    tenantId: string,
    automationId: string,
    node: { id?: string; type: string; position?: unknown; config?: unknown; nextNodeIds?: string[] }
  ) {
    await this.getById(tenantId, automationId);
    if (node.id) {
      return prisma.automationNode.update({
        where: { id: node.id },
        data: { type: node.type as any, position: node.position as any, config: node.config as any, nextNodeIds: node.nextNodeIds ?? [] },
      });
    }
    return prisma.automationNode.create({
      data: {
        automationId,
        type: node.type as any,
        position: node.position as any,
        config: node.config as any,
        nextNodeIds: node.nextNodeIds ?? [],
      },
    });
  }

  async deleteNode(tenantId: string, automationId: string, nodeId: string) {
    await this.getById(tenantId, automationId);
    await prisma.automationNode.delete({ where: { id: nodeId } });
  }
}

export const automationsService = new AutomationsService();
