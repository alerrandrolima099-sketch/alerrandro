import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";

/**
 * Guard de isolamento multi-tenant (seção 21 - obrigatório).
 *
 * Regras:
 * - CLIENT: tenantId é sempre derivado do próprio token (req.user.tenantId).
 *   Qualquer tenantId vindo de body/params/query é IGNORADO para roles CLIENT -
 *   isso é o que impede o Cliente A de acessar dados do Cliente B trocando um ID na URL.
 * - ADMIN: pode opcionalmente atuar sobre um tenant específico via header
 *   'x-tenant-id' (para telas administrativas de suporte); sem o header, atua
 *   sobre o tenant interno da plataforma.
 *
 * O middleware injeta `req.tenantId`, que TODOS os repositórios/serviços devem
 * usar como filtro obrigatório em toda query (never trust client-supplied tenantId).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ statusCode: 401, message: "Not authenticated" });
  }

  if (req.user.role === "CLIENT") {
    req.tenantId = req.user.tenantId;
    return next();
  }

  // ADMIN
  const impersonatedTenantId = req.header("x-tenant-id");
  if (impersonatedTenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: impersonatedTenantId } });
    if (!tenant) {
      return res.status(404).json({ statusCode: 404, message: "Tenant not found" });
    }
    req.tenantId = tenant.id;
  } else {
    req.tenantId = req.user.tenantId;
  }
  return next();
}
