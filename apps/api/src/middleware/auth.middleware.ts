import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@whatsapp-saas/config";
import type { JwtUserPayload } from "@whatsapp-saas/types";

// Estende o Request do Express com o usuário autenticado.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}

/**
 * Valida o access token JWT no header Authorization: Bearer <token>.
 * Popula req.user com { sub, tenantId, role }.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ statusCode: 401, message: "Missing access token" });
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ statusCode: 401, message: "Invalid or expired access token" });
  }
}

/** Restringe a rota a um conjunto de roles (ex: apenas ADMIN). */
export function requireRole(...roles: Array<"ADMIN" | "CLIENT">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ statusCode: 401, message: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ statusCode: 403, message: "Insufficient permissions" });
    }
    return next();
  };
}
