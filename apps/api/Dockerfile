FROM node:20-alpine

# O binário "schema engine" do Prisma (usado por "prisma db push"/"migrate",
# diferente do "query engine" usado em runtime pelo PrismaClient) precisa de
# libssl para funcionar no Alpine/musl; sem isso o preDeployCommand falha com
# "Could not parse schema engine response".
RUN apk add --no-cache openssl

# Diretório de trabalho = raiz do monorepo dentro do container.
WORKDIR /app

# Copiamos a raiz + TODOS os packages internos + a própria API.
# IMPORTANTE: outras apps (worker, web) não são necessárias para esta imagem,
# então não são copiadas - mantém o build enxuto sem quebrar o workspace,
# já que "apps/*" no package.json raiz é um glob (não exige que todas existam).
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/api ./apps/api

# CRÍTICO: o "npm install" roda a partir da RAIZ do monorepo (WORKDIR /app),
# nunca de dentro de apps/api. É isso que faz o npm reconhecer
# @whatsapp-saas/core, /database, /types e /config como workspaces LOCAIS
# (symlinks em /app/node_modules/@whatsapp-saas/*) em vez de tentar buscá-los
# no registry.npmjs.org (causa do erro 404 relatado).
RUN npm install

# O "prisma generate" valida a presença de DATABASE_URL (referenciada via
# env() no schema.prisma) mesmo sem se conectar de fato ao banco neste passo.
# Um valor fictício é suficiente só para o build; em runtime o valor real
# vem do docker-compose.yml / .env.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build_only"

# Gera o Prisma Client - obrigatório antes de compilar @whatsapp-saas/database
# (que reexporta @prisma/client) e qualquer pacote que dependa dele.
RUN npm run generate --workspace=@whatsapp-saas/database

# Compila os pacotes internos NA ORDEM DE DEPENDÊNCIA (types/config não
# dependem de nada; database depende do Prisma Client já gerado; core
# depende de database/types/config já compilados em dist/).
RUN npm run build --workspace=@whatsapp-saas/types
RUN npm run build --workspace=@whatsapp-saas/config
RUN npm run build --workspace=@whatsapp-saas/database
RUN npm run build --workspace=@whatsapp-saas/core

# Só então compilamos a API (que importa @whatsapp-saas/core, /database etc.
# já como .js + .d.ts em dist/, evitando o erro de rootDir do TypeScript).
RUN npm run build --workspace=@whatsapp-saas/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
