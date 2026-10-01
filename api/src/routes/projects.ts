import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors.js";
import { assertProject } from "../lib/fs.js";
import * as actions from "../services/actions.js";
import { githubCommits, localCommits } from "../services/git.js";
import { importFiles, importZip } from "../services/importer.js";
import { jobs } from "../services/jobs.js";
import { patchManifest } from "../services/manifest.js";
import { findCoverFile, getProject, iconPath, invalidate, listProjects } from "../services/projects.js";
import { createProject, listTemplates } from "../services/scaffold.js";
import { hub } from "../services/status.js";

export const projects = Router();

const slugParam = (req: Request) => String(req.params.slug);

projects.get("/projects", async (_req, res) => {
  res.json({ projects: await listProjects(), status: hub.status });
});

projects.post("/projects", async (req, res) => {
  const { slug, job } = await createProject(req.body);
  res.status(202).json({ slug, jobId: job.id });
});

projects.get("/projects/:slug", async (req, res) => {
  const p = await getProject(slugParam(req), req.query.fresh === "1");
  res.json({ project: p, status: hub.status[p.slug] });
});

projects.patch("/projects/:slug", async (req, res) => {
  const slug = slugParam(req);
  const p = await getProject(slug);
  await patchManifest(p.path, p.manifest.name, req.body);
  invalidate(slug);
  hub.emit("projects");
  void hub.checkProd();
  res.json({ project: await getProject(slug) });
});

projects.get("/projects/:slug/commits", async (req, res) => {
  const p = await getProject(slugParam(req));
  const remote = p.git.github ? await githubCommits(p.git.github) : undefined;
  if (remote) return void res.json({ source: "github", repo: p.git.github, commits: remote });
  res.json({ source: "local", repo: p.git.github, commits: await localCommits(p.path) });
});

// ---- cover + icon -------------------------------------------------------

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

projects.get("/projects/:slug/cover", async (req, res) => {
  const root = await assertProject(slugParam(req));
  const file = await findCoverFile(root);
  if (!file) throw notFound("Cover");
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(file, { dotfiles: "allow" });
});

projects.post("/projects/:slug/cover", imageUpload.single("file"), async (req, res) => {
  const slug = slugParam(req);
  const root = await assertProject(slug);
  const ext = req.file && IMAGE_TYPES[req.file.mimetype];
  if (!req.file || !ext) throw badRequest("Upload a png, jpg, webp, avif or gif image");
  let old: string | undefined;
  while ((old = await findCoverFile(root))) await fs.rm(old);
  await fs.mkdir(path.join(root, ".aurora"), { recursive: true });
  await fs.writeFile(path.join(root, ".aurora", `cover.${ext}`), req.file.buffer);
  const p = await getProject(slug);
  await patchManifest(root, p.manifest.name, { cover: { ...p.manifest.cover, image: "file", position: { x: 50, y: 50 } } });
  invalidate(slug);
  hub.emit("projects");
  res.json({ project: await getProject(slug) });
});

projects.delete("/projects/:slug/cover", async (req, res) => {
  const slug = slugParam(req);
  const root = await assertProject(slug);
  let old: string | undefined;
  while ((old = await findCoverFile(root))) await fs.rm(old);
  const p = await getProject(slug);
  await patchManifest(root, p.manifest.name, { cover: { ...p.manifest.cover, image: undefined } });
  invalidate(slug);
  hub.emit("projects");
  res.json({ project: await getProject(slug) });
});

projects.get("/projects/:slug/icon", async (req, res) => {
  const file = await iconPath(slugParam(req));
  if (!file) throw notFound("Icon");
  // SVGs from project folders are untrusted: never let them run scripts if opened directly.
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.setHeader("Cache-Control", "max-age=300");
  res.sendFile(file, { dotfiles: "allow" });
});

// ---- actions ------------------------------------------------------------

const RenameSchema = z.object({ name: z.string().trim().min(1).max(80), folder: z.string().optional() });

projects.post("/projects/:slug/actions/:action", async (req, res) => {
  const slug = slugParam(req);
  const action = String(req.params.action);
  const body = (req.body ?? {}) as Record<string, unknown>;
  switch (action) {
    case "run":
    case "restart":
    case "stop": {
      const job = await actions.lifecycle(slug, action, { build: body.build === true });
      return void res.status(202).json({ jobId: job.id });
    }
    case "tests":
    case "coverage": {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : undefined;
      const job = await actions.runTests(slug, action, ids);
      return void res.status(202).json({ jobId: job.id });
    }
    case "database": {
      const r = await actions.openDatabase(slug);
      return void res.json(r.configured ? { configured: true, url: r.url, jobId: r.job.id } : r);
    }
    case "database-configure": {
      const r = await actions.configureDatabase(slug);
      return void res.json(r.configured ? { configured: true, url: r.url, jobId: r.job.id } : r);
    }
    case "folder":
      return void res.json(await actions.folder(slug));
    case "rename":
      return void res.json(await actions.rename(slug, RenameSchema.parse(body)));
    case "remove": {
      const job = await actions.remove(slug, { stop: body.stop !== false });
      return void res.status(202).json({ jobId: job.id });
    }
    default:
      throw notFound("Action");
  }
});

projects.get("/jobs", (req, res) => {
  res.json({ jobs: jobs.list(req.query.slug ? String(req.query.slug) : undefined) });
});

projects.get("/jobs/:id", (req, res) => {
  const job = jobs.get(String(req.params.id));
  if (!job) throw notFound("Job");
  res.json({ job });
});

// ---- templates + import -------------------------------------------------

projects.get("/templates", async (_req, res) => {
  res.json({ templates: await listTemplates() });
});

const upload = multer({
  dest: path.join(os.tmpdir(), "aurora-uploads"),
  preservePath: true,
  limits: { fileSize: 512 * 1024 * 1024, files: 20_000, fieldSize: 4 * 1024 * 1024 },
});

projects.post("/import", upload.array("files"), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const opts = {
    name: typeof req.body.name === "string" ? req.body.name : undefined,
    source: typeof req.body.source === "string" ? req.body.source : undefined,
    description: typeof req.body.description === "string" ? req.body.description : undefined,
  };
  // Browsers drop directories from multipart filenames unless sent separately.
  const paths: string[] = req.body.paths ? [req.body.paths].flat().map(String) : [];
  try {
    if (!files.length) throw badRequest("No files received");
    let result: { slug: string };
    if (files.length === 1 && /\.zip$/i.test(files[0].originalname)) {
      result = await importZip(files[0].path, files[0].originalname, opts);
    } else {
      result = await importFiles(
        files.map((f, i) => ({ relPath: paths[i] || f.originalname, tmpPath: f.path })),
        opts,
      );
    }
    res.status(201).json(result);
  } finally {
    await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
  }
});
