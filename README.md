# WhatsApp SaaS — Gerenciamento de Instâncias e Automações

SaaS multi-tenant para gerenciamento de múltiplas instâncias de WhatsApp Business
e automação de atendimento, **sem cobrança/planos/checkout nesta versão** (a
arquitetura já está preparada para adicionar isso no futuro sem retrabalho).

> ⚠️ **Sem integração real de mensageria "de fábrica".** Por padrão o sistema
> roda com `MessagingProvider=MOCK` (simula envios/conexões, sem tocar nenhum
> serviço externo). Para produção real, configure a WhatsApp Business Cloud
> API oficial — veja [Ativando o provedor oficial](#ativando-o-provedor-oficial-whatsapp-cloud-api).

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + lucide-react
- **Backend**: Node.js + TypeScript + Express (arquitetura modular) + Socket.IO
- **Banco**: PostgreSQL + Prisma ORM
- **Filas**: Redis + BullMQ (5 filas: mensagens, sessões, automações, webhooks, notificações)
- **Auth**: JWT (access + refresh com rotação) + argon2
- **Infra**: Docker + Docker Compose

## Estrutura do projeto

```
/apps
  /web      -> Next.js (frontend)
  /api      -> Express API (REST + WebSocket)
  /worker   -> Workers BullMQ (processadores das filas)
/packages
  /database -> Prisma schema, client singleton, seed
  /types    -> Tipos e constantes compartilhadas
  /config   -> Variáveis de ambiente centralizadas
  /core     -> MessagingProvider, AutomationEngine, SenderPool, QueueService
              (compartilhado entre api e worker — nunca duplicado)
/docs       -> Documentação detalhada (arquitetura, API, banco, deploy)
```

## Requisitos

- Node.js 20+
- Docker e Docker Compose
- (Para dev sem Docker) PostgreSQL 16+ e Redis 7+ rodando localmente

## Subindo com Docker (recomendado)

```bash
cp .env.example .env
# edite o .env se quiser trocar segredos/portas

docker compose up -d --build

# Rode as migrations e o seed uma vez os containers estiverem de pé:
docker compose exec api npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
docker compose exec api node -e "require('child_process').execSync('npm run seed --workspace=@whatsapp-saas/database', {stdio:'inherit', cwd:'/app'})"
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/health

## Rodando localmente sem Docker (desenvolvimento)

```bash
npm install                      # instala todos os workspaces
cp .env.example .env

# Suba Postgres/Redis (ex: via docker apenas para essas duas dependências)
docker compose up -d postgres redis

npm run db:generate
npm run db:migrate
npm run db:seed

# Em 3 terminais separados:
npm run dev:api
npm run dev:worker
npm run dev:web
```

Login de teste após o seed:
- **Admin**: `admin@platform.local` / `Admin@12345`
- **Cliente**: `cliente@demo.local` / `Cliente@12345`

## Rodando os testes

Os testes de integração (`apps/api/src/tests`) usam banco e Redis reais — não
são mockados, porque o próprio objetivo dos testes é garantir isolamento
multi-tenant real. Suba `postgres`/`redis` antes de rodar:

```bash
docker compose up -d postgres redis
npm run db:migrate
npm run test --workspace=@whatsapp-saas/api
```

Testes incluídos: fluxo de autenticação (registro/login/rotação de refresh
token), **isolamento multi-tenant** (Cliente A nunca acessa dados do Cliente
B, mesmo sabendo o ID), e lock atômico do pool de números via Redis.

## Ativando o provedor oficial (WhatsApp Cloud API)

1. Crie um app no Meta Business Manager e habilite o WhatsApp Business Platform.
2. Gere um token de acesso permanente e obtenha o `PHONE_NUMBER_ID`.
3. No `.env`, defina:
   ```
   MESSAGING_PROVIDER=WHATSAPP_CLOUD_API
   MESSAGING_API_URL=https://graph.facebook.com/v20.0/<PHONE_NUMBER_ID>
   MESSAGING_API_TOKEN=<seu-token>
   WEBHOOK_SECRET=<app-secret-do-meta>
   ```
4. Configure a URL de webhook do Meta apontando para `https://<seu-dominio>/webhooks/messaging`.
5. Reinicie `api` e `worker`.

A implementação está em `packages/core/src/messaging/WhatsAppCloudProvider.ts`
— ela falha explicitamente (nunca finge sucesso) se as credenciais não
estiverem configuradas.

## Regras de negócio importantes já implementadas

- **Multi-tenancy real**: todo dado de cliente carrega `tenantId`; o middleware
  `resolveTenant` ignora qualquer `tenantId` vindo de input de um usuário
  `CLIENT` — o tenant vem sempre do token JWT.
- **Consentimento/opt-out (LGPD)**: contatos só recebem mensagens automáticas
  se `status = ACTIVE`; opt-out interrompe automações e é auditado.
- **Pool de números com lock Redis**: garante que dois atendimentos nunca
  usem o mesmo número simultaneamente.
- **Idempotência de webhooks**: chave de idempotência derivada do payload,
  com índice único no banco — eventos duplicados são ignorados.
- **Sem burla de bloqueios/anti-spam**: intervalos entre mensagens existem
  apenas para ritmo de atendimento, nunca para evadir detecção da plataforma.

## Documentação adicional

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/api.md`](docs/api.md)
- [`docs/database.md`](docs/database.md)
- [`docs/deployment.md`](docs/deployment.md)

## Limitações conhecidas desta entrega

- O editor visual de automações (drag-and-drop de nodes) não está incluído —
  os nodes são criados via API (`POST /automations/:id/nodes`); a tela atual
  lista/ativa/pausa automações.
- Onboarding guiado (seção 32 do escopo original) não foi implementado como
  tela dedicada.
- Não há suíte de testes E2E de UI (Playwright/Cypress) — apenas testes de
  integração de API.
