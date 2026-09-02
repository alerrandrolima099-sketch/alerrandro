import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { env } from "@whatsapp-saas/config";
import { redisConnection } from "@whatsapp-saas/core";
import type { JwtUserPayload } from "@whatsapp-saas/types";

/**
 * Gateway WebSocket - atualizações em tempo real do dashboard, instâncias,
 * sessões e notificações (seções 5, 6, 17), e das Conversas (seção 36).
 *
 * Autenticação: o client conecta com `auth: { token: <accessToken> }`.
 * Cada socket entra automaticamente na room `tenant:<tenantId>` -
 * garantindo que eventos de um tenant nunca vazem para outro (multi-tenancy
 * também se aplica ao realtime).
 *
 * Adapter Redis: quem cria a maioria das mensagens (webhook da Cloud API,
 * evento "messages.upsert" do Baileys, IA respondendo, automação) roda no
 * processo WORKER, não neste processo api - onde o servidor Socket.IO de
 * fato vive. O adapter Redis (pub/sub no mesmo REDIS_URL já usado pelo
 * BullMQ) é o que permite ao worker publicar um evento e ele chegar aos
 * clientes conectados aqui - ver packages/core/src/realtime/emitter.ts, o
 * lado que o worker usa para publicar.
 */
let io: SocketIOServer | null = null;

export function initWebsocketGateway(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  const pubClient = redisConnection.duplicate();
  const subClient = redisConnection.duplicate();
  pubClient.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[websocket] redis pub client error:", err.message);
  });
  subClient.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[websocket] redis sub client error:", err.message);
  });
  io.adapter(createAdapter(pubClient, subClient));

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
