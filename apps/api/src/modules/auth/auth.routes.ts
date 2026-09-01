import { Router } from "express";
import { z } from "zod";
import { authService } from "./auth.service";
import { requireAuth } from "../../middleware/auth.middleware";
import { loginRateLimiter } from "../../middleware/rateLimit";

export const authRouter = Router();

const registerSchema = z.object({
  tenantName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", loginRateLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login({
      ...body,
      ip: req.ip,
      userAgent: req.header("user-agent"),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({ refreshToken: z.string() });

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    await authService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.sub, body.currentPassword, body.newPassword);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
