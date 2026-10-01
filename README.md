# Aurora

Local dashboard to organize, run and scaffold all your projects. Nord theme, glass UI, live status over websockets.

- **Dashboard**: cards (cover image, name, description, tags, tool badges) or a list view with customizable columns and a full **features matrix** (Social login, PWA, Offline, Admin, Backup, …).
- **Detection**: reads `package.json`, `requirements*.txt`/`pyproject.toml`, `composer.json`, Dockerfiles, compose files and CI configs to find frameworks, versions (Node, React, Alpine, Postgres…), test scripts and features.
- **Status**: local status from Docker (`docker ps` + `docker events`), production status from an HTTP health check. Each project chooses `local`, `prod` or `both`.
- **Actions** (project page toolbar and right-click menu): Folder, GitHub, Database (pgAdmin), Tests, Coverage, Run, Restart, Stop, Rename, Remove.
- **New project**: templates (React, React + Express, React + FastAPI, static site) following the [planner](https://github.com/thiagobraga/planner) layout, or **import** a dropped folder / `.zip` (ChatGPT, Claude, v0 exports).
- **System**: CPU, memory, disk, containers and memory per project.

## Quickstart

```bash
cp .env.example .env
vi .env                      # PROJECTS_DIR, DOCKER_GID, DOCKER_USER
docker network create proxy  # skip if your Traefik network already exists
docker compose up -d
```

Open http://localhost:7700 (or https://aurora.local through Traefik).

`DOCKER_GID`: `stat -c %g /var/run/docker.sock`

## How it works

```
app/  React 19 + Vite + Tailwind 4 + TanStack Query + Recharts   :5173
api/  Express 5 + Socket.IO + zod, drives the docker CLI          :4000
      templates/   project templates (layers + per-template files)
```

The api container mounts `PROJECTS_DIR` **at the same absolute path** as on the host, plus the Docker socket. Relative bind mounts in each project's compose file therefore resolve to real host paths when Aurora runs `docker compose`.

Websocket events: `status` (per-project runtime state), `metrics` (host samples every 5s), `projects` (list changed), `job:start|output|end` (streamed command output).

### Do I need a central database?

No. State is split in two small JSON files:

| File | Content |
| --- | --- |
| `<project>/.aurora/project.json` | name, description, tags, cover, status source, URLs, feature overrides. Travels with the project (git, zip, another machine). |
| `<project>/.aurora/cover.*` | cover image |
| `PROJECTS_DIR/.aurora/state.json` | favorites, view, list columns, open-folder URL |
| `PROJECTS_DIR/.aurora/trash/` | removed projects (never deleted) |

Everything else (toolset, tests, git, containers) is detected on demand and cached in memory. Each project keeps its own isolated database in its compose stack. If Aurora later needs history (uptime over weeks, test runs), SQLite in `PROJECTS_DIR/.aurora/` is enough; no extra container on a 1 GB VPS.

Add `.aurora/` to a project's `.gitignore` if you don't want the metadata versioned.

## Actions

| Action | What runs |
| --- | --- |
| Folder | copies the path and opens `openFolderUrl` (default `vscode://file{path}`, change in Settings) |
| Database | `docker compose --profile debug up -d pgadmin`. Without pgAdmin, *Configure* adds a `pgadmin` service with `profiles: [debug]`, a `127.0.0.1` port and `servers.json` (original compose backed up to `.aurora/backups/`) |
| Tests / Coverage | every `test*` / `coverage` npm script and pytest; `docker compose exec -T <svc>` when running, `run --rm --no-deps` otherwise |
| Run / Restart / Stop | `docker compose up -d` / `restart` / `stop` (never `down -v`) |
| Rename | display name; optional folder rename (stopped only, pins `COMPOSE_PROJECT_NAME` in `.env` so volumes survive) |
| Remove | `docker compose stop`, then moves the folder to `.aurora/trash/` |

## Templates

`api/templates/<id>/template.json` lists `layers` from `api/templates/_layers/` copied in order, then the template's own files. Tokens: `__NAME__`, `__SLUG__`, `__ID__`, `__DESCRIPTION__`, `__DOMAIN__`, `__ENTRYPOINT__`, `__DB_PASSWORD__`. `_gitignore`, `_dockerignore`, `_env.example` are renamed to their dotfile names.

Every template ships `compose.yml` (dev, Traefik labels, pgAdmin under `debug`) and `compose.prod.yml` (memory limits sized for a 1 GB OCI instance, read-only containers, loopback port for a host reverse proxy).

## Security

- The api has full Docker access (root-equivalent on the host). The UI port binds to `127.0.0.1` only; keep it that way.
- Set `AURORA_TOKEN` to require a bearer token for the API and websocket.
- Commands run through `execFile` with argument arrays (no shell). Slugs are validated, uploads are checked for zip-slip, project SVG icons are served with a restrictive CSP.

## Development

```bash
docker compose exec api npm test
docker compose exec app npm test
docker compose exec api npm run typecheck
docker compose exec app npm run build
```
