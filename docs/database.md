# Banco de dados

Schema completo em `packages/database/prisma/schema.prisma`. PostgreSQL + Prisma.

## Entidades principais e relacionamentos

```
Tenant
 ├── User (1:N) — cada usuário pertence a exatamente um tenant
 │    └── RefreshToken (1:N)
 ├── Instance (1:N)
 │    ├── Sender (1:N) — pool de números de atendimento
 │    ├── Conversation (1:N)
 │    ├── Session (1:N)
 │    └── Message (1:N)
 ├── Contact (1:N)
 │    ├── Consent (1:N) — histórico de consentimento (LGPD)
 │    ├── Conversation (1:N)
 │    ├── Session (1:N)
 │    └── Invite (1:N)
 ├── Automation (1:N)
 │    ├── AutomationNode (1:N) — grafo do fluxo
 │    └── AutomationExecution (1:N) — instância de execução por sessão
 ├── Group (1:N)
 │    └── Invite (1:N)
 ├── WebhookEvent (1:N, opcional — pode não ter tenant resolvido ainda)
 ├── Log (1:N)
 └── Notification (1:N)
```

## Por que `tenantId` está em quase toda tabela

Esta é a garantia de isolamento multi-tenant (seção 21 do escopo). Mesmo
tabelas que já têm um caminho indireto até o tenant (ex: `Message` via
`Conversation` via `Instance`) recebem `tenantId`/`instanceId` diretos quando
isso evita joins custosos e, principalmente, quando isso simplifica o filtro
de segurança nas queries do backend.

## Migrations

```bash
npm run db:generate   # gera o Prisma Client
npm run db:migrate    # cria/aplica migration em dev (prisma migrate dev)
```

Em produção, use `prisma migrate deploy` (sem prompts interativos) — já
referenciado no `Dockerfile`/README.

## Seed

`packages/database/prisma/seed.ts` cria:

- Tenant administrativo interno + usuário `ADMIN`
- Tenant "Cliente Demo Ltda" + usuário `CLIENT`
- 1 instância (`MOCK`) para o cliente demo
- 3 senders (números do pool) vinculados a essa instância
- 1 automação de demonstração com nodes `START → SEND_MESSAGE → WAIT_FOR_REPLY → END`

## Índices relevantes

- `@@unique([tenantId, phone])` em `Contact` — evita duplicidade de contato
  por telefone dentro do mesmo tenant (mas permite o mesmo telefone em
  tenants diferentes).
- `@@unique` em `WebhookEvent.idempotencyKey` — é o mecanismo que impede
  reprocessar o mesmo evento de webhook duas vezes.
- Índices em todo campo `tenantId` para acelerar os filtros de isolamento
  multi-tenant, que acontecem em praticamente toda query da aplicação.
