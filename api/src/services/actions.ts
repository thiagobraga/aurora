import fs from "node:fs/promises";
import path from "node:path";
import { auroraDir, config } from "../config.js";
import { badRequest, conflict } from "../lib/errors.js";
import { assertProject, exists, projectPath, readText, SLUG_RE } from "../lib/fs.js";
import type { Project, TestCommand } from "../types.js";
import { jobs, type Step } from "./jobs.js";
import { patchManifest } from "./manifest.js";
import { addPgadmin } from "./pgadmin.js";
import { getProject, invalidate } from "./projects.js";
import { getState, patchState } from "./state.js";
import { hub } from "./status.js";

const compose = (root: string, ...args: string[]): Step => ({ cmd: "docker", args: ["compose", ...args], cwd: root, cleanEnv: true });

function requireCompose(p: Project) {
  if (!p.compose.file) throw badRequest("Project has no compose file");
}

const after = (slug: string) => () => {
  invalidate(slug);
  void hub.refresh();
};

export async function lifecycle(slug: string, action: "run" | "restart" | "stop", opts: { build?: boolean } = {}) {
  const p = await getProject(slug);
  requireCompose(p);
  const args = { run: ["up", "-d", ...(opts.build ? ["--build"] : [])], restart: ["restart"], stop: ["stop"] }[action];
  return jobs.start({ slug, kind: action, label: `${action} ${p.manifest.name}` }, [compose(p.path, ...args)], after(slug));
}

function testStep(p: Project, t: TestCommand): Step {
  const running = new Set(hub.status[p.slug]?.containers.filter((c) => c.state === "running").map((c) => c.service));
  if (t.service && running.has(t.service)) return compose(p.path, "exec", "-T", t.service, ...t.command);
  if (t.service) return compose(p.path, "run", "--rm", "--no-deps", "-T", t.service, ...t.command);
  return { cmd: t.command[0], args: t.command.slice(1), cwd: path.join(p.path, t.dir), cleanEnv: true };
}

/** Runs the selected (or all) test commands of a kind, one after another. */
export async function runTests(slug: string, kind: "tests" | "coverage", ids?: string[]) {
  const p = await getProject(slug, true);
  let list = p.tests.filter((t) => (kind === "coverage" ? t.kind === "coverage" : t.kind !== "coverage"));
  if (ids?.length) list = p.tests.filter((t) => ids.includes(t.id));
  if (!list.length) throw badRequest(kind === "coverage" ? "No coverage command found (add a `coverage` script)" : "No test commands found");
  const steps = list.map((t) => ({ ...testStep(p, t), allowFail: true }));
  return jobs.start({ slug, kind, label: `${kind}: ${list.map((t) => t.label).join(", ")}` }, steps, after(slug));
}

/** Starts the project's pgAdmin (debug profile) or reports that it needs configuring. */
export async function openDatabase(slug: string) {
  const p = await getProject(slug, true);
  const svc = p.compose.services.find((s) => /pgadmin/.test(s.image ?? ""));
  if (!svc) {
    const hasPg = p.compose.services.some((s) => /postgres|postgis/.test(s.image ?? ""));
    return { configured: false as const, canConfigure: hasPg && !!p.compose.file };
  }
  const job = jobs.start(
    { slug, kind: "database", label: `pgAdmin ${p.manifest.name}` },
    [compose(p.path, ...svc.profiles.flatMap((pr) => ["--profile", pr]), "up", "-d", svc.name)],
    after(slug),
  );
  return { configured: true as const, url: p.links.pgadmin, job };
}

export async function configureDatabase(slug: string) {
  const p = await getProject(slug, true);
  requireCompose(p);
  const { url } = await addPgadmin(p.path, p.compose.file!);
  await patchManifest(p.path, p.manifest.name, { urls: { ...p.manifest.urls, pgadmin: url } });
  invalidate(slug);
  return openDatabase(slug);
}

export async function folder(slug: string) {
  const root = await assertProject(slug);
  const { openFolderUrl } = await getState();
  return { path: root, url: openFolderUrl.replace("{path}", root) };
}

export async function rename(slug: string, body: { name: string; folder?: string }) {
  const root = await assertProject(slug);
  const p = await getProject(slug);
  await patchManifest(root, p.manifest.name, { name: body.name });
  let newSlug = slug;
  if (body.folder && body.folder !== slug) {
    if (!SLUG_RE.test(body.folder)) throw badRequest("Folder name must be lowercase letters, numbers, . _ -");
    const target = projectPath(body.folder);
    if (await exists(target)) throw conflict("A folder with that name already exists");
    if (hub.status[slug]?.containers.some((c) => c.state === "running")) throw conflict("Stop the project before renaming its folder");
    // Compose derives the project name (and so volume names) from the folder.
    // Pin the old name so existing database volumes keep working.
    const envFile = path.join(root, ".env");
    const env = (await readText(envFile)) ?? "";
    if (p.compose.file && !/^COMPOSE_PROJECT_NAME=/m.test(env))
      await fs.writeFile(envFile, `${env}${env && !env.endsWith("\n") ? "\n" : ""}COMPOSE_PROJECT_NAME=${slug}\n`);
    await fs.rename(root, target);
    newSlug = body.folder;
    const st = await getState();
    if (st.favorites.includes(slug)) await patchState({ favorites: st.favorites.map((f) => (f === slug ? newSlug : f)) });
  }
  invalidate();
  void hub.refresh();
  return { slug: newSlug };
}

/** Never deletes: stops containers (volumes kept) and moves the folder to .aurora/trash. */
export async function remove(slug: string, opts: { stop?: boolean } = {}) {
  const root = await assertProject(slug);
  const p = await getProject(slug);
  const trash = path.join(auroraDir(), "trash");
  await fs.mkdir(trash, { recursive: true });
  const target = path.join(trash, `${slug}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const steps: Parameters<typeof jobs.start>[1] = [];
  if (opts.stop !== false && p.compose.file) steps.push({ ...compose(root, "stop"), allowFail: true });
  steps.push(async (log) => {
    await fs.rename(root, target);
    log(`Moved to ${path.relative(config.projectsDir, target)}\n`);
    const st = await getState();
    if (st.favorites.includes(slug)) await patchState({ favorites: st.favorites.filter((f) => f !== slug) });
  });
  return jobs.start({ slug, kind: "remove", label: `remove ${p.manifest.name}` }, steps, () => {
    invalidate();
    void hub.refresh();
    hub.emit("projects");
  });
}
