import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { badRequest, conflict } from "../lib/errors.js";
import { exists, readJson, slugify, SLUG_RE } from "../lib/fs.js";
import { initRepo } from "./git.js";
import { jobs } from "./jobs.js";
import { ManifestSchema, writeManifest } from "./manifest.js";
import { invalidate } from "./projects.js";
import { hub } from "./status.js";
import type { Manifest } from "../types.js";

export interface Template {
  id: string;
  name: string;
  description: string;
  layers: string[];
  tools: string[];
  services: string[];
  tags: string[];
  order: number;
}

export async function listTemplates(): Promise<Template[]> {
  const entries = await fs.readdir(config.templatesDir, { withFileTypes: true });
  const out: Template[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith("_")) continue;
    const t = await readJson<Template>(path.join(config.templatesDir, e.name, "template.json"));
    if (t) out.push({ ...t, id: e.name });
  }
  return out.sort((a, b) => a.order - b.order);
}

export const CreateSchema = z.object({
  template: z.string(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().optional(),
  description: z.string().max(500).default(""),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).default([]),
  start: z.boolean().default(true),
});

const TEXT = /\.(json|ya?ml|md|txt|ts|tsx|js|jsx|mjs|cjs|css|html|py|toml|cfg|ini|conf|sh|env|example|svg|gitignore|dockerignore)$|(^|\/)(Dockerfile|\.env[^/]*|_[a-z]+)$/i;

/** Template file names that would otherwise be treated specially by git/npm. */
const RENAMES: Record<string, string> = { _gitignore: ".gitignore", _dockerignore: ".dockerignore", "_env.example": ".env.example" };

async function copyDir(src: string, dst: string, tokens: Record<string, string>) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src, { withFileTypes: true })) {
    if (e.name === "template.json") continue;
    const from = path.join(src, e.name);
    const to = path.join(dst, RENAMES[e.name] ?? e.name);
    if (e.isDirectory()) await copyDir(from, to, tokens);
    else if (TEXT.test(e.name)) {
      let s = await fs.readFile(from, "utf8");
      for (const [k, v] of Object.entries(tokens)) s = s.replaceAll(k, v);
      await fs.writeFile(to, s);
      if (e.name.endsWith(".sh")) await fs.chmod(to, 0o755);
    } else await fs.copyFile(from, to);
  }
}

export async function createProject(input: z.input<typeof CreateSchema>) {
  const body = CreateSchema.parse(input);
  const tpl = (await listTemplates()).find((t) => t.id === body.template);
  if (!tpl) throw badRequest("Unknown template");
  const slug = body.slug ? body.slug : slugify(body.name);
  if (!SLUG_RE.test(slug)) throw badRequest("Invalid folder name");
  const target = path.join(config.projectsDir, slug);
  if (await exists(target)) throw conflict(`Folder "${slug}" already exists`);
  await fs.mkdir(target); // reserve the name before the job starts

  const tokens: Record<string, string> = {
    __SLUG__: slug,
    __ID__: slug.replace(/[._]/g, "-"),
    __NAME__: body.name,
    __DESCRIPTION__: body.description || body.name,
    __DOMAIN__: config.localDomain,
    __ENTRYPOINT__: config.traefikEntrypoint,
    __DB_PASSWORD__: randomBytes(12).toString("hex"),
    __YEAR__: String(new Date().getFullYear()),
  };

  const steps: Parameters<typeof jobs.start>[1] = [
    async (log) => {
      for (const layer of [...tpl.layers, tpl.id]) {
        const dir = layer === tpl.id ? path.join(config.templatesDir, tpl.id) : path.join(config.templatesDir, "_layers", layer);
        log(`copy ${layer}\n`);
        await copyDir(dir, target, tokens);
      }
      const envExample = path.join(target, ".env.example");
      if (await exists(envExample)) await fs.copyFile(envExample, path.join(target, ".env"));
      const manifest = ManifestSchema.parse({
        name: body.name,
        description: body.description,
        tags: body.tags,
        template: tpl.id,
        createdAt: new Date().toISOString(),
        urls: { local: `https://${slug}.${config.localDomain}` },
      }) as Manifest;
      await writeManifest(target, manifest);
      await initRepo(target, `Scaffold ${body.name} from ${tpl.name}`);
      log(`created ${slug}/ and initial commit\n`);
      invalidate();
      hub.emit("projects");
    },
  ];
  if (body.start) steps.push({ cmd: "docker", args: ["compose", "up", "-d", "--build"], cwd: target, cleanEnv: true });

  const job = jobs.start({ slug, kind: "create", label: `create ${body.name}` }, steps, () => {
    invalidate();
    void hub.refresh();
  });
  return { slug, job };
}
