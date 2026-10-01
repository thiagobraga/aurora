FROM nginx:1.31-alpine
RUN apk upgrade --no-cache
COPY site /usr/share/nginx/html
COPY .docker/site/nginx.conf /etc/nginx/conf.d/default.conf
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
