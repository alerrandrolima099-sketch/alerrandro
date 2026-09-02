FROM node:20-alpine

WORKDIR /app

# O web não depende de nenhum pacote @whatsapp-saas/* hoje (fala com a API só
# via HTTP/WebSocket), mas ainda assim instalamos a partir da RAIZ do
# monorepo por consistência e para já funcionar se um pacote interno
# (ex: @whatsapp-saas/types para tipos compartilhados de request/response)
# for adicionado como dependência do frontend no futuro.
# cache-bust(qr-code-feature): força o Railway a reconhecer que o conteúdo
# de apps/web mudou (o build anterior ficou com cache travado depois de uma
# alteração só dentro de apps/web/src/app/(app)/instances/page.tsx).
#
# git: o "npm install" roda a partir da RAIZ do monorepo (workspaces), então
# resolve TODAS as dependências de TODOS os pacotes internos de uma vez -
# inclusive @whiskeysockets/baileys (usado só por @whatsapp-saas/core), que
# depende de um pacote (libsignal) publicado direto no GitHub, não no npm.
# Sem o binário "git" o "npm install" falha com "spawn git ENOENT", mesmo
# aqui no web não importando baileys diretamente.
RUN apk add --no-cache git

COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm install

# CRÍTICO: variáveis NEXT_PUBLIC_* do Next.js são inlinadas no bundle JS em
# tempo de BUILD, não lidas em runtime. O Railway só repassa uma variável de
# serviço para dentro do "docker build" se ela for declarada aqui como ARG -
# sem isso o front-end compila com o fallback "http://localhost:4000"
# hardcoded (bug já visto em produção: login dava "Failed to fetch").
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=@whatsapp-saas/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
