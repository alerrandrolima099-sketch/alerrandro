# Arquitetura

## Visão geral

```
┌─────────────┐     HTTP/WS      ┌─────────────┐
│   web (Next) │ ───────────────▶│  api (Express)│
└─────────────┘                  └──────┬──────┘
                                         │ enqueue jobs
                                         ▼
                                  ┌─────────────┐
                                  │    Redis     │◀──── locks (sender pool)
                                  │  (BullMQ)    │
                                  └──────┬──────┘
                                         │ consume jobs
                                         ▼
                                  ┌─────────────┐
                                  │   worker     │───▶ MessagingProvider
                                  └──────┬──────┘        (Mock | WhatsApp Cloud API)
                                         ▼
                                  ┌─────────────┐
                                  │  PostgreSQL  │
                                  └─────────────┘
```

## Separação de responsabilidades (packages/core)

O código que precisa ser idêntico entre `api` e `worker` vive em
`packages/core`, para nunca divergir:

- **`messaging/`** — `MessagingProvider` (interface), `MockProvider`,
  `WhatsAppCloudProvider`. A API só chama `connectInstance`/`disconnectInstance`
  ao gerenciar instâncias; o worker só chama `sendTextMessage`/`sendGroupInvite`
  ao processar filas. Nenhum dos dois fala com o SDK do provedor diretamente.
- **`automation/automationEngine.ts`** — interpreta o grafo de
  `AutomationNode`s de uma `Automation`. Chamado pela API só para *iniciar*
  uma execução; o *processamento* de cada passo roda no worker.
- **`senderPool/senderPool.service.ts`** — algoritmo de distribuição do pool
  de números com lock atômico (`SET NX EX` no Redis).
- **`queues/queueService.ts`** — única porta de entrada para publicar jobs.

## Multi-tenancy

Todo modelo de dado de cliente carrega `tenantId` (ver `packages/database/prisma/schema.prisma`).
O middleware `resolveTenant` (`apps/api/src/middleware/tenant.middleware.ts`)
é a única fonte de verdade sobre "qual tenant estou operando":

- Para `role = CLIENT`: `req.tenantId = req.user.tenantId` (do JWT) — **sempre**,
  ignorando qualquer valor vindo de `body`/`query`/`params`.
- Para `role = ADMIN`: pode opcionalmente atuar sobre um tenant específico via
  header `x-tenant-id` (para telas de suporte), sem que o cliente tenha esse poder.

Todo service (`instances.service.ts`, `contacts.service.ts` etc.) recebe
`tenantId` como primeiro parâmetro explícito e o usa como filtro obrigatório
em toda query Prisma — nunca faz `findUnique({ id })` sozinho sem checar o tenant.

## Filas e workers

| Fila                | Produzido por          | Consumido por                    |
|---------------------|-------------------------|-----------------------------------|
| `messageQueue`       | API (manual) / AutomationEngine | `message.processor.ts` — envia via MessagingProvider |
| `sessionQueue`       | `SessionsService.start` | `session.processor.ts` — avança etapa ao expirar o tempo |
| `automationQueue`    | `AutomationEngine`      | `automation.processor.ts` — interpreta o próximo node |
| `webhookQueue`       | `POST /webhooks/messaging` | `webhook.processor.ts` — atualiza mensagens/instâncias, retoma automações aguardando resposta |
| `notificationQueue`  | Serviços diversos       | `notification.processor.ts` — persiste notificações in-app |

Todas as filas usam `attempts: 5` com backoff exponencial e
`removeOnFail` configurado (ver `defaultJobOptions` em `queueService.ts`) —
funcionando como dead-letter implícito (jobs falhos ficam retidos por 24h
para inspeção antes de serem descartados).

## Escalabilidade (seção 33 do escopo)

- Múltiplas réplicas de `worker` podem rodar em paralelo — o lock do sender
  pool é por Redis, não por processo, então não há condição de corrida entre
  réplicas.
- Novos números podem ser adicionados ao pool a qualquer momento via
  `Sender.create` — não há limite fixo de 3 no código, esse número é apenas o
  seed inicial.
- Novos provedores de mensageria podem ser adicionados implementando
  `MessagingProvider` e registrando no factory `getMessagingProvider()`.
