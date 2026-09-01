import http from "http";
import { createApp } from "./app";
import { initWebsocketGateway } from "./websocket/gateway";
import { env } from "@whatsapp-saas/config";

const app = createApp();
const server = http.createServer(app);

initWebsocketGateway(server);

server.listen(env.API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on port ${env.API_PORT} (${env.NODE_ENV})`);
  // eslint-disable-next-line no-console
  console.log(`[api] messaging provider: ${env.MESSAGING_PROVIDER}`);
});
