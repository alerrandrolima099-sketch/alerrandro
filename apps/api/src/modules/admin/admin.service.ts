import { prisma } from "../../lib/prisma";
import { AppError } from "../../middleware/error.middleware";

/**
 * Área administrativa (seção 18). Sem cobrança/planos - apenas gestão de
 * clientes (tenants), instâncias, pool de números e métricas globais.
 */
export class AdminService {
  async listTenants() {
    return prisma.tenant.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { instances: true, users: true } } } });
  }

  async createTenant(name: string) {
    return prisma.tenant.create({ data: { name } });
  }

  async setTenantStatus(id: string, status: "ACTIVE" | "BLOCKED" | "SUSPENDED") {
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new AppError(404, "Cliente não encontrado");
    return prisma.tenant.update({ where: { id }, data: { status } });
  }

  async globalMetrics() {
    const [tenants, instances, connectedInstances, activeSessions, messagesToday] = await Promise.all([
      prisma.tenant.count(),
      prisma.instance.count(),
      prisma.instance.count({ where: { status: "CONNECTED" } }),
      prisma.session.count({ where: { status: "ACTIVE" } }),
      prisma.message.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    return { tenants, instances, connectedInstances, activeSessions, messagesToday };
  }

  async listAllInstances() {
    return prisma.instance.findMany({ include: { tenant: true }, orderBy: { createdAt: "desc" } });
  }

  async listAllSenders() {
    return prisma.sender.findMany({ include: { instance: { include: { tenant: true } } } });
  }
}

export const adminService = new AdminService();
