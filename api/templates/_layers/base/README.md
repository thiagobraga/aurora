# __NAME__

__DESCRIPTION__

## Quickstart

```bash
cp .env.example .env
docker compose up -d
```

Local URL: https://__SLUG__.__DOMAIN__ (add `127.0.0.1 __SLUG__.__DOMAIN__` to `/etc/hosts` if your Traefik setup needs it).

Debug tools (pgAdmin, coverage) are behind the `debug` profile:

```bash
docker compose --profile debug up -d
```

## Production

```bash
docker compose -f compose.prod.yml up -d --build
```

Scaffolded by Aurora.
