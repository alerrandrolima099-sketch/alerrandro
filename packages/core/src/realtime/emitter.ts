import { Emitter } from "@socket.io/redis-emitter";
import { redisConnection } from "../redis";

/**
 * Ponte de tempo real para código que roda no processo worker (fora do
 * processo api, onde o servidor Socket.IO de fato vive - ver
 * apps/api/src/websocket/gateway.ts).
 *
 * O worker não tem (e não precisa ter) seu próprio servidor Socket.IO: o
 * Emitter só PUBLICA no mesmo canal Redis que o adapter Socket.IO do lado
 * da api já está OUVINDO (`@socket.io/redis-adapter`), então um evento
 * publicado aqui chega exatamente igual a um `io.to(...).emit(...)` feito
 * dentro do próprio processo api. Mesma convenção de rooms (`tenant:<id>`)
 * usada em apps/api/src/websocket/gateway.ts - não é por acaso, é assim que
 * os dois lados se encontram.
 */
const emitter = new Emitter(redisConnection);

/** Emite um evento para todos os clientes conectados de um tenant específico. */
export function emitToTenant(tenantId: string, event: string, payload: unknown) {
  emitter.to(`tenant:${tenantId}`).emit(event, payload);
}
