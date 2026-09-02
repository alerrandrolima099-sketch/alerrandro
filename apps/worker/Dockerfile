FROM node:20-alpine

WORKDIR /app

# openssl: necessário para o Prisma engine funcionar em Alpine (musl), sem
# isso a schema/query engine falha ao iniciar ("Could not parse schema
# engine response" / "Please manually install OpenSSL").
# git: o pacote @whiskeysockets/baileys (conexão via QR Code) depende de um
# pacote (libsignal) publicado direto no GitHub, não no npm - sem o binário
# "git" o "npm install" falha com "spawn git ENOENT".
RUN apk add --no-cache openssl git

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
