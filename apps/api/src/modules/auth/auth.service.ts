import argon2 from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { env } from "@whatsapp-saas/config";
import { AppError } from "../../middleware/error.middleware";
import { writeLog } from "../../lib/logger";
import type { JwtUserPayload } from "@whatsapp-saas/types";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(payload: JwtUserPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any });
}

function signRefreshToken(payload: JwtUserPayload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
}

export class AuthService {
  async register(params: { tenantName: string; name: string; email: string; password: string }) {
    const existing = await prisma.user.findUnique({ where: { email: params.email } });
    if (existing) throw new AppError(409, "Email já cadastrado");

    const tenant = await prisma.tenant.create({ data: { name: params.tenantName } });
    const passwordHash = await argon2.hash(params.password);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: params.name,
        email: params.email,
        passwordHash,
        role: "CLIENT",
      },
    });

    await writeLog({ tenantId: tenant.id, userId: user.id, action: "USER_REGISTERED", resource: "user", resourceId: user.id });

    return { userId: user.id, tenantId: tenant.id };
  }

  async login(params: { email: string; password: string; ip?: string; userAgent?: string }) {
    const user = await prisma.user.findUnique({ where: { email: params.email } });
    if (!user) throw new AppError(401, "Credenciais inválidas");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(423, "Conta temporariamente bloqueada por excesso de tentativas");
    }
    if (!user.isActive) throw new AppError(403, "Usuário desativado");

    const valid = await argon2.verify(user.passwordHash, params.password);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      const shouldLock = failedCount >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : user.lockedUntil,
        },
      });
      await writeLog({ tenantId: user.tenantId, userId: user.id, action: "LOGIN_FAILED", resource: "user", resourceId: user.id, ip: params.ip });
      throw new AppError(401, "Credenciais inválidas");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const payload: JwtUserPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        userAgent: params.userAgent,
        ip: params.ip,
      },
    });

    await writeLog({ tenantId: user.tenantId, userId: user.id, action: "LOGIN_SUCCESS", resource: "user", resourceId: user.id, ip: params.ip });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, tenantId: user.tenantId },
    };
  }

  async refresh(refreshToken: string) {
    let payload: JwtUserPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtUserPayload;
    } catch {
      throw new AppError(401, "Refresh token inválido ou expirado");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new AppError(401, "Refresh token inválido ou expirado");
    }

    // Rotação: revoga o token usado e emite um novo par (mitiga replay).
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);
    await prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new AppError(401, "Senha atual incorreta");
    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Revoga todas as sessões existentes ao trocar a senha.
    await prisma.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }
}

export const authService = new AuthService();
