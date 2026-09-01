# API Reference

Base URL (dev): `http://localhost:4000`

Todas as rotas (exceto `/health`, `/auth/register`, `/auth/login`,
`/auth/refresh`, `/webhooks/messaging`) exigem header:

```
Authorization: Bearer <accessToken>
```

## Auth

| Método | Rota                     | Descrição                                  |
|--------|--------------------------|---------------------------------------------|
| POST   | `/auth/register`         | Cria tenant + usuário CLIENT                |
| POST   | `/auth/login`            | Retorna `accessToken` + `refreshToken`      |
| POST   | `/auth/refresh`          | Rotaciona o refresh token                   |
| POST   | `/auth/logout`           | Revoga o refresh token informado            |
| POST   | `/auth/change-password`  | Requer auth; revoga sessões existentes      |
| GET    | `/auth/me`               | Retorna o payload do usuário autenticado    |

## Instâncias

| Método | Rota                         | Descrição                     |
|--------|------------------------------|--------------------------------|
| GET    | `/instances`                 | Lista instâncias do tenant     |
| GET    | `/instances/:id`              | Detalhe                        |
| POST   | `/instances`                  | Cria instância (`{ name }`)     |
| POST   | `/instances/:id/connect`      | Conecta via MessagingProvider   |
| POST   | `/instances/:id/disconnect`   | Desconecta                     |
| POST   | `/instances/:id/pause`        | Pausa                          |
| DELETE | `/instances/:id`              | Remove                         |

## Contatos

| Método | Rota                             | Descrição                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/contacts`                       | Lista (filtros `?status=` `?tag=`)       |
| POST   | `/contacts`                       | Cria (`consentSource` obrigatório)       |
| POST   | `/contacts/:id/tags`               | Adiciona tag                             |
| DELETE | `/contacts/:id/tags/:tag`          | Remove tag                               |
| POST   | `/contacts/:id/opt-out`            | Opt-out (LGPD) — interrompe automações   |
| GET    | `/contacts/:id/export`             | Exporta dados do contato (LGPD)          |
| DELETE | `/contacts/:id/data`               | Exclui dados do contato (LGPD)           |

## Conversas

| Método | Rota                                     | Descrição                    |
|--------|--------------------------------------------|--------------------------------|
| GET    | `/conversations`                            | Lista (inbox)                  |
| GET    | `/conversations/:id/messages`                | Histórico de mensagens          |
| POST   | `/conversations/:id/messages`                | Envio manual (`{ content }`)    |
| POST   | `/conversations/:id/automation/pause`        | Pausa automação da conversa     |
| POST   | `/conversations/:id/automation/resume`       | Retoma automação                |

## Sessões

| Método | Rota                   | Descrição                                                  |
|--------|--------------------------|--------------------------------------------------------------|
| GET    | `/sessions`              | Lista sessões                                                 |
| POST   | `/sessions`               | Inicia sessão (adquire sender do pool)                        |
| POST   | `/sessions/:id/cancel`    | Cancela                                                        |

## Automações

| Método | Rota                              | Descrição                              |
|--------|-------------------------------------|------------------------------------------|
| GET    | `/automations`                      | Lista                                    |
| GET    | `/automations/:id`                   | Detalhe com nodes                        |
| POST   | `/automations`                       | Cria (`{ name }`)                        |
| POST   | `/automations/:id/status`            | Muda status (DRAFT/ACTIVE/PAUSED/ARCHIVED) |
| POST   | `/automations/:id/nodes`             | Cria/atualiza node                       |
| DELETE | `/automations/:id/nodes/:nodeId`     | Remove node                              |

## Grupos / Convites

| Método | Rota                        | Descrição                                             |
|--------|-------------------------------|----------------------------------------------------------|
| GET    | `/groups`                      | Lista grupos ativos                                       |
| POST   | `/groups`                      | Cria grupo (link de convite oficial)                       |
| POST   | `/groups/:id/offer`            | Oferece convite (`{ contactId }`) — checa consentimento     |
| POST   | `/groups/:id/decision`         | Registra decisão (`{ contactId, accepted }`); se aceito, envia o link |

## Dashboard / Logs / Notificações / Health

| Método | Rota                                | Descrição                       |
|--------|----------------------------------------|-------------------------------------|
| GET    | `/dashboard/summary`                    | Indicadores do dashboard             |
| GET    | `/dashboard/messages-timeseries`        | Série temporal (14 dias)             |
| GET    | `/logs?page=&pageSize=`                  | Logs de auditoria (paginado)         |
| GET    | `/notifications`                        | Notificações do tenant                |
| POST   | `/notifications/:id/read`               | Marca como lida                       |
| GET    | `/health`                               | Status da API, banco e Redis          |

## Admin (role ADMIN apenas)

| Método | Rota                          | Descrição                        |
|--------|---------------------------------|--------------------------------------|
| GET    | `/admin/tenants`                 | Lista todos os clientes               |
| POST   | `/admin/tenants`                 | Cria cliente                          |
| POST   | `/admin/tenants/:id/status`      | ACTIVE / BLOCKED / SUSPENDED          |
| GET    | `/admin/metrics`                 | Métricas globais                      |
| GET    | `/admin/instances`               | Todas as instâncias (com tenant)       |
| GET    | `/admin/senders`                 | Todos os senders (pool)                |

## Webhooks

| Método | Rota                     | Descrição                                                  |
|--------|----------------------------|----------------------------------------------------------------|
| POST   | `/webhooks/messaging`      | Recebe eventos do provedor; valida assinatura e idempotência   |

Payload esperado (formato interno, adaptar conforme o provedor real):

```json
{
  "eventType": "message_received",
  "from": "+5511999999999",
  "text": "Olá",
  "messageId": "wamid.xxx"
}
```

Eventos suportados pelo `webhook.processor.ts`: `message_received`,
`message_delivered`, `message_read`, `instance_disconnected`, `instance_error`.
