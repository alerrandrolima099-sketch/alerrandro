FROM node:20-alpine

# Ver explicação em apps/api/Dockerfile: o Prisma precisa de libssl no
# Alpine/musl para os binários do schema/query engine funcionarem.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/worker ./apps/worker

# Instala a partir da RAIZ (ver explicação detalhada em apps/api/Dockerfile).
RUN npm install

# Valor fictício só para o build (ver explicação em apps/api/Dockerfile).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build_only"

RUN npm run generate --workspace=@whatsapp-saas/database

RUN npm run build --workspace=@whatsapp-saas/types
RUN npm run build --workspace=@whatsapp-saas/config
RUN npm run build --workspace=@whatsapp-saas/database
RUN npm run build --workspace=@whatsapp-saas/core

RUN npm run build --workspace=@whatsapp-saas/worker

WORKDIR /app/apps/worker
CMD ["node", "dist/index.js"]
