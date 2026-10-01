FROM node:26.9.0-alpine3.24 AS development
WORKDIR /app
# docker-cli + compose plugin: Aurora drives each project's compose stack.
# git: local history, init of scaffolded/imported projects.
RUN apk upgrade --no-cache && apk add --no-cache tini git docker-cli docker-cli-compose
COPY --chmod=755 .docker/api/entrypoint.sh /entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
CMD ["npx", "tsx", "watch", "--clear-screen=false", "src/index.ts"]
