import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "@whatsapp-saas/config";
import type { JwtUserPayload } from "@whatsapp-saas/types";

/**
 * Gateway WebSocket - atualizações em tempo real do dashboard, instâncias,
 * sessões e notificações (seções 5, 6, 17).
 *
 * Autenticação: o client conecta com `auth: { token: <accessToken> }`.
 * Cada socket entra automaticamente na room `tenant:<tenantId>` -
 * garantindo que eventos de um tenant nunca vazem para outro (multi-tenancy
 * também se aplica ao realtime).
 */
let io: SocketIOServer | null = null;

export function initWebsocketGateway(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Missing auth token"));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtUserPayload;
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid auth token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket.data as any).user as JwtUserPayload;
    socket.join(`tenant:${user.tenantId}`);
  });

  return io;
}

/** Emite um evento para todos os clientes conectados de um tenant específico. */
export function emitToTenant(tenantId: string, event: string, payload: unknown) {
  io?.to(`tenant:${tenantId}`).emit(event, payload);
}
