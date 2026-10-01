import path from "node:path";
import YAML from "yaml";
import { readJson, readText, walk } from "../lib/fs.js";
import type { ComposeService, FeatureKey, TestCommand, Tool, ToolCategory } from "../types.js";

type Known = { id: string; name: string; category: ToolCategory; rank: number };

/** npm dependency -> tool. Rank: lower shows first on cards. */
const NPM: Record<string, Known> = {
  react: { id: "react", name: "React", category: "framework", rank: 10 },
  next: { id: "nextdotjs", name: "Next.js", category: "framework", rank: 9 },
  vue: { id: "vuedotjs", name: "Vue", category: "framework", rank: 10 },
  svelte: { id: "svelte", name: "Svelte", category: "framework", rank: 10 },
  "@angular/core": { id: "angular", name: "Angular", category: "framework", rank: 10 },
  astro: { id: "astro", name: "Astro", category: "framework", rank: 10 },
  "react-native": { id: "reactnative", name: "React Native", category: "framework", rank: 9 },
  expo: { id: "expo", name: "Expo", category: "framework", rank: 11 },
  express: { id: "express", name: "Express", category: "framework", rank: 12 },
  fastify: { id: "fastify", name: "Fastify", category: "framework", rank: 12 },
  "@nestjs/core": { id: "nestjs", name: "NestJS", category: "framework", rank: 12 },
  hono: { id: "hono", name: "Hono", category: "framework", rank: 12 },
  vite: { id: "vite", name: "Vite", category: "build", rank: 30 },
  typescript: { id: "typescript", name: "TypeScript", category: "language", rank: 25 },
  tailwindcss: { id: "tailwindcss", name: "Tailwind CSS", category: "styling", rank: 22 },
  "socket.io": { id: "socketdotio", name: "Socket.IO", category: "library", rank: 40 },
  "react-router": { id: "reactrouter", name: "React Router", category: "library", rank: 45 },
  "react-router-dom": { id: "reactrouter", name: "React Router", category: "library", rank: 45 },
  "@tanstack/react-query": { id: "reactquery", name: "TanStack Query", category: "library", rank: 46 },
  zustand: { id: "zustand", name: "Zustand", category: "library", rank: 47 },
  redux: { id: "redux", name: "Redux", category: "library", rank: 47 },
  "@reduxjs/toolkit": { id: "redux", name: "Redux Toolkit", category: "library", rank: 47 },
  prisma: { id: "prisma", name: "Prisma", category: "library", rank: 35 },
  "drizzle-orm": { id: "drizzle", name: "Drizzle", category: "library", rank: 35 },
  pg: { id: "postgresql-client", name: "node-postgres", category: "library", rank: 60 },
  redis: { id: "redis-client", name: "node-redis", category: "library", rank: 61 },
  ioredis: { id: "redis-client", name: "ioredis", category: "library", rank: 61 },
  vitest: { id: "vitest", name: "Vitest", category: "testing", rank: 50 },
  jest: { id: "jest", name: "Jest", category: "testing", rank: 50 },
  "@playwright/test": { id: "playwright", name: "Playwright", category: "testing", rank: 51 },
  cypress: { id: "cypress", name: "Cypress", category: "testing", rank: 51 },
  eslint: { id: "eslint", name: "ESLint", category: "build", rank: 70 },
  "@biomejs/biome": { id: "biome", name: "Biome", category: "build", rank: 70 },
  "vite-plugin-pwa": { id: "pwa", name: "Vite PWA", category: "library", rank: 42 },
  "lucide-react": { id: "lucide", name: "Lucide", category: "library", rank: 80 },
  "framer-motion": { id: "framer", name: "Framer Motion", category: "library", rank: 80 },
  motion: { id: "framer", name: "Motion", category: "library", rank: 80 },
  i18next: { id: "i18next", name: "i18next", category: "library", rank: 75 },
  "three": { id: "threedotjs", name: "Three.js", category: "library", rank: 41 },
  "@supabase/supabase-js": { id: "supabase", name: "Supabase", category: "library", rank: 36 },
  firebase: { id: "firebase", name: "Firebase", category: "library", rank: 36 },
};

const PY: Record<string, Known> = {
  fastapi: { id: "fastapi", name: "FastAPI", category: "framework", rank: 11 },
  django: { id: "django", name: "Django", category: "framework", rank: 11 },
  flask: { id: "flask", name: "Flask", category: "framework", rank: 11 },
  uvicorn: { id: "uvicorn", name: "Uvicorn", category: "runtime", rank: 55 },
  sqlalchemy: { id: "sqlalchemy", name: "SQLAlchemy", category: "library", rank: 35 },
  psycopg: { id: "psycopg", name: "psycopg", category: "library", rank: 60 },
  "psycopg2-binary": { id: "psycopg", name: "psycopg2", category: "library", rank: 60 },
  pydantic: { id: "pydantic", name: "Pydantic", category: "library", rank: 45 },
  pytest: { id: "pytest", name: "pytest", category: "testing", rank: 50 },
  celery: { id: "celery", name: "Celery", category: "library", rank: 45 },
};

const PHP: Record<string, Known> = {
  "laravel/framework": { id: "laravel", name: "Laravel", category: "framework", rank: 10 },
  "symfony/framework-bundle": { id: "symfony", name: "Symfony", category: "framework", rank: 10 },
  "phpunit/phpunit": { id: "phpunit", name: "PHPUnit", category: "testing", rank: 50 },
  "pestphp/pest": { id: "pest", name: "Pest", category: "testing", rank: 50 },
  "livewire/livewire": { id: "livewire", name: "Livewire", category: "library", rank: 40 },
};

/** Docker image (repository, without registry/tag) -> tool. */
const IMAGES: Record<string, Known> = {
  node: { id: "nodedotjs", name: "Node.js", category: "runtime", rank: 15 },
  python: { id: "python", name: "Python", category: "runtime", rank: 15 },
  php: { id: "php", name: "PHP", category: "runtime", rank: 15 },
  nginx: { id: "nginx", name: "nginx", category: "infra", rank: 32 },
  postgres: { id: "postgresql", name: "PostgreSQL", category: "database", rank: 18 },
  "postgis/postgis": { id: "postgresql", name: "PostGIS", category: "database", rank: 18 },
  mysql: { id: "mysql", name: "MySQL", category: "database", rank: 18 },
  mariadb: { id: "mariadb", name: "MariaDB", category: "database", rank: 18 },
  mongo: { id: "mongodb", name: "MongoDB", category: "database", rank: 18 },
  redis: { id: "redis", name: "Redis", category: "database", rank: 26 },
  valkey: { id: "redis", name: "Valkey", category: "database", rank: 26 },
  "dpage/pgadmin4": { id: "pgadmin", name: "pgAdmin", category: "database", rank: 65 },
  traefik: { id: "traefikproxy", name: "Traefik", category: "infra", rank: 33 },
  caddy: { id: "caddy", name: "Caddy", category: "infra", rank: 33 },
  "elasticsearch": { id: "elasticsearch", name: "Elasticsearch", category: "database", rank: 27 },
  "docker.elastic.co/elasticsearch/elasticsearch": { id: "elasticsearch", name: "Elasticsearch", category: "database", rank: 27 },
  rabbitmq: { id: "rabbitmq", name: "RabbitMQ", category: "infra", rank: 34 },
  minio: { id: "minio", name: "MinIO", category: "infra", rank: 34 },
  "minio/minio": { id: "minio", name: "MinIO", category: "infra", rank: 34 },
  mailpit: { id: "mailpit", name: "Mailpit", category: "infra", rank: 66 },
  "axllent/mailpit": { id: "mailpit", name: "Mailpit", category: "infra", rank: 66 },
};

export const FEATURE_DEPS: Record<string, string[]> = {
  socialLogin: [
    "passport-google-oauth20", "passport-github2", "passport-facebook", "next-auth", "@auth/core", "@auth/express",
    "@react-oauth/google", "google-auth-library", "firebase", "@supabase/supabase-js", "better-auth", "@clerk/clerk-react",
    "authlib", "social-auth-app-django", "django-allauth", "laravel/socialite", "@react-native-google-signin/google-signin",
    "expo-auth-session", "arctic", "openid-client",
  ],
  pwa: ["vite-plugin-pwa", "next-pwa", "@serwist/next", "@serwist/vite", "workbox-webpack-plugin", "@vite-pwa/sveltekit"],
  offline: ["idb", "dexie", "localforage", "workbox-window", "@tanstack/query-sync-storage-persister", "@tanstack/react-query-persist-client", "rxdb", "pouchdb"],
  admin: ["react-admin", "adminjs", "@adminjs/express", "filament/filament", "laravel/nova", "sqladmin", "flask-admin"],
  realtime: ["socket.io", "socket.io-client", "ws", "pusher", "pusher-js", "laravel-echo", "@supabase/realtime-js", "python-socketio", "channels"],
  i18n: ["i18next", "react-i18next", "react-intl", "@lingui/core", "vue-i18n", "next-intl", "babel"],
  e2e: ["@playwright/test", "playwright", "cypress", "pytest-playwright"],
};

export interface Detected {
  tools: Tool[];
  features: Partial<Record<FeatureKey, boolean>>;
  compose: { file?: string; services: ComposeService[] };
  tests: TestCommand[];
  packageInfo?: { name?: string; description?: string };
  readme?: { title?: string; summary?: string };
  icon?: string;
}

const clean = (v?: string) => v?.replace(/^[\^~>=<v\s]+/, "").split(/\s|\|\|/)[0] || undefined;

/** "node:26.9.0-alpine3.24" -> { repo: "node", tag: "26.9.0-alpine3.24" } */
export function parseImage(ref: string): { repo: string; tag?: string } {
  const noDigest = ref.split("@")[0];
  const lastSlash = noDigest.lastIndexOf("/");
  const colon = noDigest.indexOf(":", lastSlash + 1);
  let repo = colon >= 0 ? noDigest.slice(0, colon) : noDigest;
  const tag = colon >= 0 ? noDigest.slice(colon + 1) : undefined;
  repo = repo.replace(/^docker\.io\//, "").replace(/^library\//, "");
  return { repo, tag };
}

/** Pulls the leading version out of an image tag, plus the alpine/debian flavour. */
export function tagVersion(tag?: string): { version?: string; alpine?: string; distro?: string } {
  if (!tag || tag === "latest") return {};
  const version = tag.match(/^v?(\d+(?:\.\d+){0,2})/)?.[1];
  const alpine = tag.match(/alpine(\d+(?:\.\d+)?)?/);
  const distro = tag.match(/(bookworm|bullseye|trixie|slim|noble|jammy)/)?.[1];
  return { version, alpine: alpine ? alpine[1] ?? "" : undefined, distro };
}

/** Parses a compose file, extracting just what Aurora needs. Exported for tests. */
export function parseCompose(src: string): ComposeService[] {
  let doc: unknown;
  try {
    doc = YAML.parse(src);
  } catch {
    return [];
  }
  const services = (doc as { services?: Record<string, Record<string, unknown>> })?.services ?? {};
  return Object.entries(services).map(([name, s]) => {
    const labels = Array.isArray(s.labels)
      ? (s.labels as string[])
      : Object.entries((s.labels as Record<string, string>) ?? {}).map(([k, v]) => `${k}=${v}`);
    const hosts = labels
      .filter((l) => /traefik\.http\.routers\.[^.]+\.rule=/.test(l))
      .flatMap((l) => [...l.matchAll(/Host\(`([^`]+)`\)/g)].map((m) => m[1]));
    const build = typeof s.build === "string" ? s.build : (s.build as { context?: string })?.context;
    const mounts = ((s.volumes as unknown[]) ?? [])
      .map((v) => (typeof v === "string" ? v.split(":")[0] : (v as { source?: string })?.source ?? ""))
      .filter((v) => v.startsWith("./") && !/\.[a-z]+$/i.test(v))
      .map((v) => v.slice(2).replace(/\/$/, ""));
    return {
      name,
      image: typeof s.image === "string" ? s.image : undefined,
      build,
      profiles: (s.profiles as string[]) ?? [],
      ports: ((s.ports as unknown[]) ?? []).map(String),
      hosts,
      mounts,
    };
  });
}

/** Resolves `${VAR:-default}` to its default, for display only. */
export const envDefault = (v: string) =>
  v.replace(/\$\{[A-Z0-9_]+(?::?-([^}]*))?\}/gi, (_m, d: string | undefined) => d ?? "");

export const COMPOSE_FILES = ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"];

export async function findComposeFile(root: string, files: string[]): Promise<string | undefined> {
  return COMPOSE_FILES.find((f) => files.includes(f));
}

function pyDeps(src: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  // requirements.txt lines and pyproject dependency strings: name[extra]==1.2
  for (const m of src.matchAll(/^\s*["']?([A-Za-z0-9_.-]+)(?:\[[^\]]*\])?\s*(?:[=~><!]=?\s*([0-9][^,;"'\s]*))?/gm)) {
    const name = m[1].toLowerCase();
    if (/^(name|version|requires|description|readme|license|\[)/.test(name)) continue;
    out[name] = m[2];
  }
  return out;
}

export async function detect(root: string): Promise<Detected> {
  const files = await walk(root);
  const fileSet = new Set(files);
  const tools = new Map<string, Tool>();
  const features: Partial<Record<FeatureKey, boolean>> = {};
  const allDeps = new Set<string>();
  const tests: TestCommand[] = [];
  let packageInfo: Detected["packageInfo"];

  const add = (k: Known, source: string, version?: string, nameOverride?: string) => {
    const prev = tools.get(k.id);
    if (prev && (prev.version || !version)) return;
    tools.set(k.id, { id: k.id, name: nameOverride ?? k.name, category: k.category, rank: k.rank, source, version });
  };

  // ---- compose
  const composeFile = await findComposeFile(root, files);
  const services = composeFile ? parseCompose((await readText(path.join(root, composeFile))) ?? "") : [];
  if (composeFile) {
    add({ id: "docker", name: "Docker", category: "infra", rank: 14 }, composeFile);
    add({ id: "compose", name: "Compose", category: "infra", rank: 31 }, composeFile);
    features.docker = true;
  }
  for (const s of services) {
    if (!s.image) continue;
    const { repo, tag } = parseImage(envDefault(s.image));
    const k = IMAGES[repo];
    if (!k) continue;
    const tv = tagVersion(tag);
    add(k, composeFile!, tv.version);
    if (tv.alpine !== undefined) add({ id: "alpinelinux", name: "Alpine", category: "infra", rank: 20 }, composeFile!, tv.alpine || undefined);
    if (/backup/i.test(repo)) features.backup = true;
  }

  // ---- Dockerfiles
  const dockerfiles = files.filter((f) => /(^|\/)Dockerfile[^/]*$/.test(f) || /\.dockerfile$/i.test(f));
  if (dockerfiles.length) add({ id: "docker", name: "Docker", category: "infra", rank: 14 }, dockerfiles[0]);
  for (const df of dockerfiles) {
    const src = (await readText(path.join(root, df))) ?? "";
    for (const m of src.matchAll(/^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)/gim)) {
      const { repo, tag } = parseImage(m[1]);
      const k = IMAGES[repo];
      if (!k) continue;
      const tv = tagVersion(tag);
      add(k, df, tv.version);
      if (tv.alpine !== undefined) add({ id: "alpinelinux", name: "Alpine", category: "infra", rank: 20 }, df, tv.alpine || undefined);
      else if (tv.distro) add({ id: "debian", name: "Debian", category: "infra", rank: 20 }, df, tv.distro);
    }
  }

  // ---- npm packages (root + up to 2 levels deep)
  const pkgs = files.filter((f) => /(^|\/)package\.json$/.test(f) && f.split("/").length <= 3);
  for (const pf of pkgs) {
    const pkg = await readJson<{
      name?: string;
      description?: string;
      engines?: { node?: string };
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>(path.join(root, pf));
    if (!pkg) continue;
    const dir = path.dirname(pf) === "." ? "" : path.dirname(pf);
    if (!dir) packageInfo = { name: pkg.name, description: pkg.description };
    const deps = { ...pkg.devDependencies, ...pkg.dependencies };
    for (const [name, range] of Object.entries(deps)) {
      allDeps.add(name);
      const k = NPM[name];
      if (!k) continue;
      const installed = await readJson<{ version?: string }>(path.join(root, dir, "node_modules", name, "package.json"));
      add(k, pf, installed?.version ?? clean(range));
    }
    if (pkg.engines?.node) add(IMAGES.node, pf, clean(pkg.engines.node));
    else add(IMAGES.node, pf);
    for (const [script, body] of Object.entries(pkg.scripts ?? {})) {
      if (/backup/i.test(script)) features.backup = true;
      if (!/^(test|coverage|e2e)([:-]|$)|^test/.test(script)) continue;
      if (/watch|ui$|:ui|debug|headed/.test(script)) continue;
      const kind: TestCommand["kind"] = /cov/.test(script) ? "coverage" : /e2e|playwright|cypress/.test(script + body) ? "e2e" : "unit";
      const runner = /playwright/.test(body) ? "Playwright" : /cypress/.test(body) ? "Cypress" : /vitest/.test(body) ? "Vitest" : /jest/.test(body) ? "Jest" : "npm";
      tests.push({
        id: `${dir || "root"}:${script}`,
        label: `${dir || "root"} · ${script}`,
        kind,
        runner,
        dir,
        service: services.find((s) => s.mounts.includes(dir) || (dir && s.build === `./${dir}`))?.name,
        command: ["npm", "run", script],
      });
    }
  }
  const nvmrc = await readText(path.join(root, ".nvmrc"));
  if (nvmrc) add(IMAGES.node, ".nvmrc", clean(nvmrc.trim()));

  // ---- python
  const pyFiles = files.filter((f) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml)$/.test(f) && f.split("/").length <= 3);
  for (const pf of pyFiles) {
    const deps = pyDeps((await readText(path.join(root, pf))) ?? "");
    add(IMAGES.python, pf);
    const dir = path.dirname(pf) === "." ? "" : path.dirname(pf);
    for (const [name, v] of Object.entries(deps)) {
      allDeps.add(name);
      const k = PY[name];
      if (k) add(k, pf, v);
    }
    if ("pytest" in deps && !tests.some((t) => t.dir === dir && t.runner === "pytest")) {
      const service = services.find((s) => s.mounts.includes(dir) || (dir && s.build === `./${dir}`))?.name;
      tests.push({ id: `${dir || "root"}:pytest`, label: `${dir || "root"} · pytest`, kind: "unit", runner: "pytest", dir, service, command: ["pytest", "-q"] });
      if ("pytest-cov" in deps)
        tests.push({ id: `${dir || "root"}:pytest-cov`, label: `${dir || "root"} · coverage`, kind: "coverage", runner: "pytest", dir, service, command: ["pytest", "-q", "--cov", "--cov-report=json"] });
    }
  }

  // ---- php
  for (const cf of files.filter((f) => /(^|\/)composer\.json$/.test(f) && f.split("/").length <= 2)) {
    const c = await readJson<{ require?: Record<string, string>; "require-dev"?: Record<string, string> }>(path.join(root, cf));
    if (!c) continue;
    const deps = { ...c["require-dev"], ...c.require };
    if (deps.php) add(IMAGES.php, cf, clean(deps.php));
    for (const [name, range] of Object.entries(deps)) {
      allDeps.add(name);
      const k = PHP[name];
      if (k) add(k, cf, clean(range));
    }
  }

  // ---- CI
  if (files.some((f) => f.startsWith(".github/workflows/") && /\.ya?ml$/.test(f))) {
    add({ id: "githubactions", name: "GitHub Actions", category: "ci", rank: 56 }, ".github/workflows");
    features.ci = true;
  }
  if (fileSet.has(".gitlab-ci.yml")) {
    add({ id: "gitlab", name: "GitLab CI", category: "ci", rank: 56 }, ".gitlab-ci.yml");
    features.ci = true;
  }

  // ---- features
  for (const [feat, deps] of Object.entries(FEATURE_DEPS)) {
    if (deps.some((d) => allDeps.has(d))) features[feat as FeatureKey] = true;
  }
  const lower = files.map((f) => f.toLowerCase());
  if (lower.some((f) => /(^|\/)(manifest\.webmanifest|site\.webmanifest)$/.test(f) || /(^|\/)(sw|service-worker)\.(js|ts)$/.test(f)))
    features.pwa = true;
  if (lower.some((f) => /(^|\/)(sw|service-worker)\.(js|ts)$/.test(f) || /offline/.test(f))) features.offline = true;
  if (lower.some((f) => /(^|\/)admin(\/|[^/]*\.(tsx?|jsx?|py|php|vue)$)/.test(f) || /admin(page|panel)/.test(f))) features.admin = true;
  if (lower.some((f) => /backup/.test(f))) features.backup = true;
  if (lower.some((f) => /(^|\/)(locales|i18n|lang)\//.test(f))) features.i18n = true;
  if (lower.some((f) => /(oauth|social-?login|google-?auth)/.test(f))) features.socialLogin = true;
  if (tests.length) features.tests = true;
  if (tests.some((t) => t.kind === "e2e")) features.e2e = true;

  // ---- icon + readme
  const icon = ["favicon.svg", "icon.svg", "logo.svg", "favicon.png", "apple-touch-icon.png", "icon.png", "logo.png", "favicon.ico"]
    .flatMap((n) => files.filter((f) => f === n || f.endsWith(`/${n}`)).sort((a, b) => a.length - b.length))[0];

  const readmeFile = files.find((f) => /^readme\.md$/i.test(f));
  let readme: Detected["readme"];
  if (readmeFile) {
    const md = (await readText(path.join(root, readmeFile))) ?? "";
    const title = md.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const summary = md
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("!") && !p.startsWith("[!") && !p.startsWith("<") && !p.startsWith("```"))
      ?.replace(/\s+/g, " ")
      .slice(0, 240);
    readme = { title, summary };
  }

  return {
    tools: [...tools.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)),
    features,
    compose: { file: composeFile, services },
    tests,
    packageInfo,
    readme,
    icon,
  };
}
