FROM node:26.9.0-alpine3.24 AS base
WORKDIR /app
RUN apk upgrade --no-cache && apk add --no-cache tini
EXPOSE 4000

FROM base AS development
COPY --chmod=755 .docker/api/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM base AS build
COPY api ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi \
  && npm run build \
  && npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
