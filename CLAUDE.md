# AI Agent Instructions

`AGENTS.md` is a symlink to this file.

## Project

Aurora is a local project manager: dashboard of the projects in `PROJECTS_DIR`, toolset/feature detection, Docker status over websockets, actions (run/stop/tests/pgAdmin), scaffolding from templates and zip/folder import. Two npm packages: `api/` (Express 5 + Socket.IO, drives the docker CLI) and `app/` (React 19 + Vite + Tailwind 4). No database: metadata lives in `<project>/.aurora/project.json` and `PROJECTS_DIR/.aurora/state.json`.

## Commands

| Command | What it does |
| --- | --- |
| `docker compose up -d` | api (4000) + app (5173, published on 127.0.0.1:7700) |
| `docker compose exec api npm test` | API tests (Vitest + supertest) |
| `docker compose exec app npm test` | App tests |
| `docker compose exec api npm run typecheck` | API types |
| `docker compose exec app npm run build` | App types + build |

## Key files

```
api/src/services/detect.ts     toolset, features, tests, compose parsing (pure, well tested)
api/src/services/projects.ts   project model = manifest + detection + git, cached 60s
api/src/services/status.ts     StatusHub: docker ps/events/stats + prod checks -> "status" event
api/src/services/actions.ts    run/restart/stop/tests/pgAdmin/rename/remove
api/src/services/jobs.ts       background command runner, output streamed to socket rooms job:<id>
api/src/services/scaffold.ts   templates (api/templates/_layers + per-template files)
api/src/services/importer.ts   zip/folder import (zip-slip safe)
app/src/lib/actions.tsx        single action list shared by context menu and project toolbar
app/src/lib/live.tsx           socket provider: status, metrics, job output
app/src/components/Cover.tsx   cover image + readability overlays + drag-to-reposition
```

## Rules

- Never run shell strings: use `run()`/`stream()` from `api/src/lib/exec.ts` with argument arrays.
- Resolve project folders only through `projectPath()`/`assertProject()`; join user paths with `safeJoin()`.
- Never delete user data: remove = move to `.aurora/trash`, stop = `docker compose stop`, compose edits are backed up to `.aurora/backups`.
- PATCH schemas must not carry `.default()`s (a partial update would reset fields). See `ManifestPatchSchema`, `StatePatchSchema`.
- Keep `app/src/types.ts` in sync with `api/src/types.ts`.
- Status is never color-only: dot + icon + label. Feature booleans use the SVG `BoolIcon`, not glyphs.
- 2-space indentation.
