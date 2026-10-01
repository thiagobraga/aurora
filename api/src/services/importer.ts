import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import AdmZip from "adm-zip";
import { auroraDir, config } from "../config.js";
import { badRequest } from "../lib/errors.js";
import { safeJoin, slugify, uniqueSlug } from "../lib/fs.js";
import { detect } from "./detect.js";
import { initRepo } from "./git.js";
import { writeManifest, ManifestSchema } from "./manifest.js";
import { invalidate } from "./projects.js";
import { hub } from "./status.js";
import type { Manifest } from "../types.js";

const MAX_TOTAL = 1024 ** 3; // 1 GiB uncompressed
const MAX_ENTRIES = 50_000;
const SKIP = /(^|\/)(__MACOSX|node_modules|\.DS_Store|Thumbs\.db)(\/|$)/;

/** If every path shares one top-level folder, returns it (so "site/index.html" lands as "index.html"). */
export function commonRoot(paths: string[]): string | undefined {
  const tops = new Set(paths.map((p) => (p.includes("/") ? p.split("/")[0] : "")));
  if (tops.size !== 1) return undefined;
  const top = [...tops][0];
  return top || undefined;
}

export interface ImportOptions {
  name?: string;
  source?: string;
  description?: string;
}

async function stage(): Promise<string> {
  const dir = path.join(auroraDir(), "tmp", `import-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function importZip(zipPath: string, originalName: string, opts: ImportOptions) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory && !SKIP.test(e.entryName.replace(/\\/g, "/")));
  if (!entries.length) throw badRequest("Zip is empty");
  if (entries.length > MAX_ENTRIES) throw badRequest(`Zip has more than ${MAX_ENTRIES} files`);
  const total = entries.reduce((n, e) => n + e.header.size, 0);
  if (total > MAX_TOTAL) throw badRequest("Zip is larger than 1 GiB uncompressed");

  const names = entries.map((e) => e.entryName.replace(/\\/g, "/"));
  const top = commonRoot(names);
  const dir = await stage();
  try {
    for (const e of entries) {
      let rel = e.entryName.replace(/\\/g, "/");
      if (top) rel = rel.slice(top.length + 1);
      const out = safeJoin(dir, rel);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, e.getData());
      const mode = (e.attr >>> 16) & 0o777;
      if (mode & 0o111) await fs.chmod(out, 0o755);
    }
  } catch (err) {
    await fs.rm(dir, { recursive: true, force: true });
    throw err;
  }
  return finish(dir, opts.name || top || path.basename(originalName, path.extname(originalName)), opts);
}

/** Files from a dropped folder; `relPath` is webkitRelativePath ("my-site/src/main.ts"). */
export async function importFiles(files: { relPath: string; tmpPath: string }[], opts: ImportOptions) {
  const kept = files.filter((f) => !SKIP.test(f.relPath.replace(/\\/g, "/")));
  if (!kept.length) throw badRequest("No files received");
  const top = commonRoot(kept.map((f) => f.relPath.replace(/\\/g, "/")));
  const dir = await stage();
  try {
    for (const f of kept) {
      let rel = f.relPath.replace(/\\/g, "/");
      if (top) rel = rel.slice(top.length + 1);
      const out = safeJoin(dir, rel);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.copyFile(f.tmpPath, out);
    }
  } catch (err) {
    await fs.rm(dir, { recursive: true, force: true });
    throw err;
  }
  return finish(dir, opts.name || top || "imported", opts);
}

async function finish(staged: string, name: string, opts: ImportOptions) {
  const slug = await uniqueSlug(slugify(name));
  const target = path.join(config.projectsDir, slug);
  await fs.rename(staged, target);

  const det = await detect(target);
  const tags = ["imported", ...(opts.source ? [slugify(opts.source)] : [])];
  const manifest = ManifestSchema.parse({
    name: det.readme?.title ?? det.packageInfo?.name ?? name,
    description: opts.description || det.packageInfo?.description || det.readme?.summary || "",
    tags,
    importedFrom: opts.source,
    createdAt: new Date().toISOString(),
  }) as Manifest;
  await writeManifest(target, manifest);
  await initRepo(target, `Import${opts.source ? ` from ${opts.source}` : ""}`);
  invalidate();
  hub.emit("projects");
  void hub.refresh();
  return { slug };
}
