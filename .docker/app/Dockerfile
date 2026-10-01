FROM node:26.9.0-alpine3.24 AS development
WORKDIR /app
RUN apk upgrade --no-cache
COPY --chmod=755 .docker/app/entrypoint.sh /entrypoint.sh
EXPOSE 5173
ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]
