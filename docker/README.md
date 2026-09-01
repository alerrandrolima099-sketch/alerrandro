# Docker

Os Dockerfiles ficam junto de cada app (`apps/api/Dockerfile`,
`apps/worker/Dockerfile`, `apps/web/Dockerfile`) para que o build context de
cada imagem seja o mais enxuto possível. A orquestração de todos os serviços
(Postgres, Redis, api, worker, web) está no `docker-compose.yml` na raiz do
projeto — rode `docker compose up -d --build` a partir da raiz.
