import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { badRequest, notFound } from "./errors.js";

export const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function slugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 64);
  return s || "project";
}

/** Resolves a project slug to its folder, refusing anything outside PROJECTS_DIR. */
export function projectPath(slug: string): string {
  if (!SLUG_RE.test(slug)) throw badRequest("Invalid project slug");
  const p = path.join(config.projectsDir, slug);
  if (path.dirname(p) !== config.projectsDir) throw badRequest("Invalid project slug");
  return p;
}

/** Joins `rel` under `root`, throwing if the result escapes root (zip-slip, ../). */
export function safeJoin(root: string, rel: string): string {
  const clean = rel.replace(/\\/g, "/");
  if (path.isAbsolute(clean) || clean.split("/").includes("..")) throw badRequest(`Unsafe path: ${rel}`);
  const out = path.resolve(root, clean);
  if (out !== root && !out.startsWith(root + path.sep)) throw badRequest(`Unsafe path: ${rel}`);
  return out;
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readText(p: string, max = 1024 * 1024): Promise<string | undefined> {
  try {
    const st = await fs.stat(p);
    if (!st.isFile() || st.size > max) return undefined;
    return await fs.readFile(p, "utf8");
  } catch {
    return undefined;
  }
}

export async function readJson<T = unknown>(p: string): Promise<T | undefined> {
  const t = await readText(p);
  if (t === undefined) return undefined;
  try {
    return JSON.parse(t) as T;
  } catch {
    return undefined;
  }
}

export async function writeJson(p: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + "\n");
  await fs.rename(tmp, p);
}

export async function assertProject(slug: string): Promise<string> {
  const p = projectPath(slug);
  try {
    if (!(await fs.stat(p)).isDirectory()) throw new Error();
  } catch {
    throw notFound("Project");
  }
  return p;
}

/** First free "<base>", "<base>-2", ... inside PROJECTS_DIR. */
export async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base);
  for (let i = 1; i < 1000; i++) {
    const s = i === 1 ? root : `${root}-${i}`;
    if (!(await exists(path.join(config.projectsDir, s)))) return s;
  }
  throw badRequest("Could not find a free project name");
}

const IGNORE = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", "coverage", "coverage-reports",
  ".venv", "venv", "__pycache__", "vendor", ".turbo", ".cache", "test-results", "playwright-report", ".aurora",
]);

/** Bounded recursive listing of relative paths (files and dirs, dirs end with /). */
export async function walk(root: string, maxDepth = 5, maxEntries = 6000): Promise<string[]> {
  const out: string[] = [];
  async function rec(dir: string, rel: string, depth: number) {
    if (depth > maxDepth || out.length >= maxEntries) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= maxEntries) return;
      if (IGNORE.has(e.name)) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        out.push(r + "/");
        await rec(path.join(dir, e.name), r, depth + 1);
      } else if (e.isFile()) out.push(r);
    }
  }
  await rec(root, "", 0);
  return out;
}
