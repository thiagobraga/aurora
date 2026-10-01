FROM node:26.9.0-alpine3.24 AS development
WORKDIR /app
RUN apk upgrade --no-cache
COPY --chmod=755 .docker/app/entrypoint.sh /entrypoint.sh
EXPOSE 5173
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]

FROM node:26.9.0-alpine3.24 AS build
WORKDIR /app
COPY app ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm run build

FROM nginx:1.31-alpine AS production
RUN apk upgrade --no-cache
COPY --from=build /app/dist /usr/share/nginx/html
COPY .docker/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
