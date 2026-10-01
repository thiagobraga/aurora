import path from "node:path";
import { z } from "zod";
import { readJson, writeJson } from "../lib/fs.js";
import { FEATURE_KEYS, type Manifest } from "../types.js";

/**
 * Per-project metadata lives in <project>/.aurora/project.json so it travels
 * with the project (git, zip, another machine). Everything is optional on
 * disk; detection fills the gaps.
 */
const url = z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//.test(v), "Must be an http(s) URL");

const cover = z.object({
  image: z.string().max(500).optional(),
  position: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).default({ x: 50, y: 50 }),
  overlay: z.number().min(0).max(100).default(60),
});

const urls = z.object({
  local: url.optional(),
  prod: url.optional(),
  github: url.optional(),
  healthPath: z.string().max(200).optional(),
  pgadmin: url.optional(),
  coverage: url.optional(),
});

/** Fields without defaults: a PATCH must only touch what it sends. */
const fields = {
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500),
  tags: z.array(z.string().trim().min(1).max(32)).max(20),
  cover,
  statusSource: z.enum(["local", "prod", "both"]),
  urls,
  features: z.partialRecord(z.enum(FEATURE_KEYS), z.boolean()),
  createdAt: z.string().optional(),
  template: z.string().optional(),
  importedFrom: z.string().optional(),
};

export const ManifestSchema = z.object({
  ...fields,
  description: fields.description.default(""),
  tags: fields.tags.default([]),
  cover: cover.default({ position: { x: 50, y: 50 }, overlay: 60 }),
  statusSource: fields.statusSource.default("local"),
  urls: urls.default({}),
  features: fields.features.default({}),
});

export const ManifestPatchSchema = z.object(fields).partial();

export const manifestPath = (root: string) => path.join(root, ".aurora", "project.json");

export async function readManifest(root: string, fallbackName: string): Promise<{ manifest: Manifest; onDisk: boolean }> {
  const raw = await readJson<Record<string, unknown>>(manifestPath(root));
  const parsed = ManifestSchema.safeParse({ name: fallbackName, ...(raw ?? {}) });
  if (parsed.success) return { manifest: parsed.data as Manifest, onDisk: !!raw };
  return { manifest: ManifestSchema.parse({ name: fallbackName }) as Manifest, onDisk: false };
}

export async function writeManifest(root: string, m: Manifest): Promise<void> {
  await writeJson(manifestPath(root), ManifestSchema.parse(m));
}

export async function patchManifest(root: string, fallbackName: string, patch: unknown): Promise<Manifest> {
  const p = ManifestPatchSchema.parse(patch);
  const { manifest } = await readManifest(root, fallbackName);
  const next = {
    ...manifest,
    ...p,
    cover: { ...manifest.cover, ...(p.cover ?? {}) },
    urls: { ...manifest.urls, ...(p.urls ?? {}) },
    features: p.features ? { ...p.features } : manifest.features,
  } as Manifest;
  // Empty strings clear a URL instead of storing "".
  for (const k of Object.keys(next.urls) as (keyof Manifest["urls"])[]) if (!next.urls[k]) delete next.urls[k];
  await writeManifest(root, next);
  return next;
}
