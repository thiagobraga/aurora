import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { assertProject, exists, readJson, SLUG_RE } from "../lib/fs.js";
import { FEATURE_KEYS, type CoverageSummary, type FeatureKey, type FeatureValue, type Project } from "../types.js";
import { detect, envDefault, type Detected } from "./detect.js";
import { gitInfo } from "./git.js";
import { readManifest } from "./manifest.js";

const cache = new Map<string, { at: number; project: Project }>();
const TTL = 60_000;

export function invalidate(slug?: string) {
  if (slug) cache.delete(slug);
  else cache.clear();
}

export async function listSlugs(): Promise<string[]> {
  await fs.mkdir(config.projectsDir, { recursive: true });
  const entries = await fs.readdir(config.projectsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && SLUG_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

export async function listProjects(): Promise<Project[]> {
  const slugs = await listSlugs();
  const out: Project[] = [];
  // Small batches: each project spawns a few git processes.
  for (let i = 0; i < slugs.length; i += 6) {
    out.push(...(await Promise.all(slugs.slice(i, i + 6).map((s) => getProject(s).catch(() => undefined)))).filter((p): p is Project => !!p));
  }
  return out;
}

export async function getProject(slug: string, fresh = false): Promise<Project> {
  const hit = cache.get(slug);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.project;
  const root = await assertProject(slug);
  const [det, git, st] = await Promise.all([detect(root), gitInfo(root), fs.stat(root)]);
  const fallbackName = det.readme?.title ?? det.packageInfo?.name ?? slug;
  const { manifest, onDisk } = await readManifest(root, fallbackName);
  if (!onDisk && !manifest.description) manifest.description = det.packageInfo?.description ?? det.readme?.summary ?? "";

  const features = {} as Record<FeatureKey, FeatureValue>;
  for (const k of FEATURE_KEYS) {
    const manual = manifest.features[k];
    features[k] = manual !== undefined ? { value: manual, source: "manual" } : { value: !!det.features[k], source: "detected" };
  }

  const coverFile = await findCoverFile(root);
  const project: Project = {
    slug,
    path: root,
    manifest,
    tools: det.tools,
    features,
    compose: det.compose,
    tests: det.tests,
    coverage: await coverageSummaries(root, det),
    git,
    hasCoverFile: !!coverFile,
    coverVersion: coverFile ? Math.round((await fs.stat(coverFile)).mtimeMs) : undefined,
    hasIcon: !!det.icon,
    links: links(det, manifest, git.github),
    updatedAt: git.lastCommitAt ?? st.mtime.toISOString(),
  };
  cache.set(slug, { at: Date.now(), project });
  iconCache.set(slug, det.icon);
  return project;
}

const iconCache = new Map<string, string | undefined>();
export async function iconPath(slug: string): Promise<string | undefined> {
  if (!iconCache.has(slug)) await getProject(slug);
  const rel = iconCache.get(slug);
  return rel ? path.join(await assertProject(slug), rel) : undefined;
}

export async function findCoverFile(root: string): Promise<string | undefined> {
  for (const ext of ["webp", "jpg", "jpeg", "png", "avif", "gif"]) {
    const p = path.join(root, ".aurora", `cover.${ext}`);
    if (await exists(p)) return p;
  }
  return undefined;
}

function hostUrl(svc?: { hosts: string[]; ports: string[] }): string | undefined {
  if (!svc) return undefined;
  const host = svc.hosts.map(envDefault).find(Boolean);
  if (host) return `https://${host}`;
  const port = svc.ports.map((p) => envDefault(p).split(":")).find((parts) => parts.length >= 2);
  if (port) return `http://localhost:${port[port.length - 2]}`;
  return undefined;
}

function links(det: Detected, m: Project["manifest"], github?: string): Project["links"] {
  const svcs = det.compose.services;
  const web =
    svcs.find((s) => ["app", "web", "frontend", "site", "client"].includes(s.name) && !s.profiles.length) ??
    svcs.find((s) => !s.profiles.length && (s.hosts.length || s.ports.length) && !/postgres|redis|mysql|mongo|pgadmin/.test(s.image ?? ""));
  const pgadmin = svcs.find((s) => /pgadmin/.test(s.image ?? ""));
  const coverage = svcs.find((s) => s.name === "coverage");
  return {
    local: m.urls.local ?? hostUrl(web),
    prod: m.urls.prod,
    github: m.urls.github ?? (github ? `https://github.com/${github}` : undefined),
    pgadmin: m.urls.pgadmin ?? hostUrl(pgadmin),
    coverage: m.urls.coverage ?? hostUrl(coverage),
  };
}

const pct = (v: unknown) => (typeof v === "number" ? Math.round(v * 10) / 10 : undefined);

async function coverageSummaries(root: string, det: Detected): Promise<CoverageSummary[]> {
  const dirs = [...new Set(["", ...det.tests.map((t) => t.dir)])];
  const out: CoverageSummary[] = [];
  for (const dir of dirs) {
    for (const rel of ["coverage/coverage-summary.json", "coverage-reports/coverage-summary.json", "coverage.json"]) {
      const file = path.join(root, dir, rel);
      const data = await readJson<Record<string, any>>(file);
      if (!data) continue;
      const st = await fs.stat(file);
      if (data.total) {
        out.push({
          lines: pct(data.total.lines?.pct),
          statements: pct(data.total.statements?.pct),
          branches: pct(data.total.branches?.pct),
          functions: pct(data.total.functions?.pct),
          file: path.join(dir, rel),
          updatedAt: st.mtime.toISOString(),
        });
      } else if (data.totals) {
        out.push({ lines: pct(data.totals.percent_covered), file: path.join(dir, rel), updatedAt: st.mtime.toISOString() });
      }
      break;
    }
  }
  return out;
}
