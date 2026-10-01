import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { config } from "../config.js";
import { invalidate } from "../services/projects.js";
import { resetStateCache } from "../services/state.js";

let root: string;
const app = createApp();

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "aurora-api-"));
  config.projectsDir = root;
  resetStateCache();
  invalidate();
  await fs.mkdir(path.join(root, "alpha"));
  await fs.writeFile(path.join(root, "alpha", "package.json"), JSON.stringify({ name: "alpha", description: "First", dependencies: { react: "19.0.0" } }));
});
afterAll(() => fs.rm(root, { recursive: true, force: true }));

describe("projects api", () => {
  it("lists projects with detected metadata", async () => {
    const res = await request(app).get("/api/v1/projects").expect(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0]).toMatchObject({ slug: "alpha", manifest: { name: "alpha", description: "First" } });
  });

  it("patches the manifest and persists it in the project folder", async () => {
    await request(app)
      .patch("/api/v1/projects/alpha")
      .send({ name: "Alpha", tags: ["web"], statusSource: "prod", urls: { prod: "https://alpha.example.com" }, features: { admin: true } })
      .expect(200);
    const disk = JSON.parse(await fs.readFile(path.join(root, "alpha", ".aurora", "project.json"), "utf8"));
    expect(disk).toMatchObject({ name: "Alpha", tags: ["web"], statusSource: "prod", urls: { prod: "https://alpha.example.com" } });
    const res = await request(app).get("/api/v1/projects/alpha").expect(200);
    expect(res.body.project.features.admin).toEqual({ value: true, source: "manual" });
    expect(res.body.project.links.prod).toBe("https://alpha.example.com");
    // A partial patch must not reset other fields to their defaults.
    await request(app).patch("/api/v1/projects/alpha").send({ cover: { position: { x: 10, y: 20 }, overlay: 30 } }).expect(200);
    const after = JSON.parse(await fs.readFile(path.join(root, "alpha", ".aurora", "project.json"), "utf8"));
    expect(after).toMatchObject({ name: "Alpha", tags: ["web"], statusSource: "prod", cover: { position: { x: 10, y: 20 }, overlay: 30 } });
  });

  it("rejects invalid manifests and unknown slugs", async () => {
    await request(app).patch("/api/v1/projects/alpha").send({ urls: { prod: "javascript:alert(1)" } }).expect(400);
    await request(app).get("/api/v1/projects/..%2Fetc").expect(400);
    await request(app).get("/api/v1/projects/missing").expect(404);
  });

  it("stores favorites in state", async () => {
    const res = await request(app).patch("/api/v1/state").send({ favorites: ["alpha"], view: "list" }).expect(200);
    expect(res.body.state).toMatchObject({ favorites: ["alpha"], view: "list" });
    const again = await request(app).patch("/api/v1/state").send({ sort: "updated" }).expect(200);
    expect(again.body.state).toMatchObject({ favorites: ["alpha"], view: "list", sort: "updated" });
  });

  it("imports a zip, stripping the top folder", async () => {
    const zip = new AdmZip();
    zip.addFile("my-site/index.html", Buffer.from("<h1>hi</h1>"));
    zip.addFile("my-site/README.md", Buffer.from("# My Site\n\nMade with ChatGPT.\n"));
    zip.addFile("my-site/node_modules/x/index.js", Buffer.from(""));
    const res = await request(app)
      .post("/api/v1/import")
      .field("source", "ChatGPT")
      .attach("files", zip.toBuffer(), "my-site.zip")
      .expect(201);
    expect(res.body.slug).toBe("my-site");
    const files = await fs.readdir(path.join(root, "my-site"));
    expect(files).toEqual(expect.arrayContaining(["index.html", "README.md", ".aurora"]));
    expect(files).not.toContain("node_modules");
    const p = (await request(app).get("/api/v1/projects/my-site").expect(200)).body.project;
    expect(p.manifest).toMatchObject({ name: "My Site", description: "Made with ChatGPT.", tags: ["imported", "chatgpt"] });
  });

  it("rejects zip-slip archives", async () => {
    const zip = new AdmZip();
    zip.addFile("ok.txt", Buffer.from("x"));
    // adm-zip normalizes names on addFile; patch the entry name afterwards.
    zip.getEntries()[0].entryName = "../../evil.txt";
    await request(app).post("/api/v1/import").attach("files", zip.toBuffer(), "evil.zip").expect(400);
    await expect(fs.access(path.join(root, "..", "evil.txt"))).rejects.toThrow();
  });

  it("imports a dropped folder using relative paths", async () => {
    const res = await request(app)
      .post("/api/v1/import")
      .field("paths", "claude-app/package.json")
      .field("paths", "claude-app/src/main.ts")
      .attach("files", Buffer.from(JSON.stringify({ name: "claude-app" })), "package.json")
      .attach("files", Buffer.from("console.log(1)"), "main.ts")
      .expect(201);
    expect(res.body.slug).toBe("claude-app");
    await fs.access(path.join(root, "claude-app", "src", "main.ts"));
  });

  it("serves the cover after upload", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
    await request(app).post("/api/v1/projects/alpha/cover").attach("files", png, "c.png").expect(400);
    await request(app).post("/api/v1/projects/alpha/cover").attach("file", png, { filename: "c.png", contentType: "image/png" }).expect(200);
    await request(app).get("/api/v1/projects/alpha/cover").expect(200).expect("content-type", /png/);
    await request(app).post("/api/v1/projects/alpha/cover").attach("file", Buffer.from("x"), { filename: "x.svg", contentType: "image/svg+xml" }).expect(400);
  });

  it("lists templates", async () => {
    const res = await request(app).get("/api/v1/templates").expect(200);
    expect(res.body.templates.map((t: { id: string }) => t.id)).toEqual(expect.arrayContaining(["react", "react-express", "react-fastapi", "static"]));
  });
});

describe("scaffold", () => {
  it.each(["react", "react-express", "react-fastapi", "static"])("creates a project from %s", async (template) => {
    const name = `Demo ${template}`;
    const res = await request(app).post("/api/v1/projects").send({ template, name, description: "d", start: false }).expect(202);
    const slug = res.body.slug as string;
    const { jobs } = await import("../services/jobs.js");
    for (let i = 0; i < 100 && jobs.get(res.body.jobId)?.status === "running"; i++) await new Promise((r) => setTimeout(r, 50));
    expect(jobs.get(res.body.jobId)?.status).toBe("success");
    const dir = path.join(root, slug);
    const files = await fs.readdir(dir);
    expect(files).toEqual(expect.arrayContaining(["compose.yml", ".gitignore", ".env", ".env.example", ".aurora", ".git", "README.md"]));
    const compose = await fs.readFile(path.join(dir, "compose.yml"), "utf8");
    expect(compose).not.toMatch(/__[A-Z_]+__/);
    expect(compose).toContain(`:-${slug}}.local`);
    const p = (await request(app).get(`/api/v1/projects/${slug}?fresh=1`).expect(200)).body.project;
    expect(p.manifest).toMatchObject({ name, template });
    expect(p.features.docker.value).toBe(true);
  });

  it("refuses an existing folder", async () => {
    await request(app).post("/api/v1/projects").send({ template: "static", name: "alpha", start: false }).expect(409);
  });
});
