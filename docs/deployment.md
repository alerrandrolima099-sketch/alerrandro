# Deployment

## Docker Compose (single-host)

```bash
cp .env.example .env
# ajuste JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY, WEBHOOK_SECRET
# para valores fortes e únicos antes de ir para produção.

docker compose up -d --build
docker compose exec api npx prisma migrate deploy --schema=/app/packages/database/prisma/schema.prisma
```

Serviços expostos:
- `web` → porta 3000
- `api` → porta 4000
- `postgres` → porta 5432 (considere não expor publicamente em produção)
- `redis` → porta 6379 (idem)

## Nginx (reverse proxy, opcional)

Exemplo mínimo para expor `web` e `api` sob o mesmo domínio com TLS
terminado no Nginx (adicione seu próprio bloco `server { listen 443 ssl; ... }`
com certificados):

```nginx
upstream web_upstream { server 127.0.0.1:3000; }
upstream api_upstream { server 127.0.0.1:4000; }

server {
    listen 80;
    server_name seu-dominio.com;

    location /api/ {
        proxy_pass http://api_upstream/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://web_upstream;
        proxy_set_header Host $host;
    }
}
```

## Escalando workers

O worker é stateless (toda coordenação passa por Redis/Postgres), então
escalar horizontalmente é apenas rodar mais réplicas:

```bash
docker compose up -d --scale worker=3
```

## Variáveis de ambiente obrigatórias em produção

| Variável              | Observação                                                        |
|-----------------------|--------------------------------------------------------------------|
| `JWT_SECRET`           | Único, forte, nunca reaproveitado do exemplo                       |
| `JWT_REFRESH_SECRET`   | Diferente de `JWT_SECRET`                                          |
| `ENCRYPTION_KEY`       | 32 bytes aleatórios (usado para criptografar credenciais de instância) |
| `WEBHOOK_SECRET`       | O App Secret real fornecido pelo Meta                               |
| `MESSAGING_PROVIDER`   | `WHATSAPP_CLOUD_API` em produção                                    |
| `MESSAGING_API_URL` / `MESSAGING_API_TOKEN` | Credenciais reais da Cloud API oficial          |
| `CORS_ORIGIN`          | Domínio real do frontend, não `localhost`                          |

## Checklist antes de ir ao ar

- [ ] Trocar todos os secrets do `.env.example`
- [ ] Rodar `prisma migrate deploy` (não `migrate dev`) contra o banco de produção
- [ ] Confirmar `MESSAGING_PROVIDER=WHATSAPP_CLOUD_API` com credenciais válidas
- [ ] Configurar a URL de webhook no painel do Meta apontando para `/webhooks/messaging`
- [ ] Restringir acesso externo direto a `postgres`/`redis` (rede interna apenas)
- [ ] Configurar HTTPS (Nginx/reverse proxy) — sem TLS, tokens JWT trafegam em texto claro
