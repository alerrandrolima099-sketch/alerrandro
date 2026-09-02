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
COPY package.json package-lock.json* ./
COPY packages ./packages
COPY apps/web ./apps/web

RUN npm install

RUN npm run build --workspace=@whatsapp-saas/web

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
