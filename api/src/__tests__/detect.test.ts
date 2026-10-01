import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detect, envDefault, parseCompose, parseImage, tagVersion } from "../services/detect.js";

describe("image parsing", () => {
  it("splits repo and tag", () => {
    expect(parseImage("node:26.9.0-alpine3.24")).toEqual({ repo: "node", tag: "26.9.0-alpine3.24" });
    expect(parseImage("docker.io/library/postgres:16-alpine")).toEqual({ repo: "postgres", tag: "16-alpine" });
    expect(parseImage("localhost:5000/foo/bar")).toEqual({ repo: "localhost:5000/foo/bar", tag: undefined });
    expect(parseImage("dpage/pgadmin4:latest")).toEqual({ repo: "dpage/pgadmin4", tag: "latest" });
  });

  it("extracts version and distro", () => {
    expect(tagVersion("26.9.0-alpine3.24")).toEqual({ version: "26.9.0", alpine: "3.24", distro: undefined });
    expect(tagVersion("3.13-slim")).toMatchObject({ version: "3.13", distro: "slim" });
    expect(tagVersion("alpine")).toMatchObject({ version: undefined, alpine: "" });
    expect(tagVersion("latest")).toEqual({});
  });

  it("resolves env defaults", () => {
    expect(envDefault("${APP:-planner}.local")).toBe("planner.local");
    expect(envDefault("${NOPE}")).toBe("");
  });
});

describe("parseCompose", () => {
  it("reads services, profiles, traefik hosts and mounts", () => {
    const s = parseCompose(`
services:
  app:
    build: ./app
    volumes: [./app:/app, ./nginx.conf:/etc/nginx.conf]
    labels:
      - "traefik.http.routers.x.rule=Host(\`\${SUB:-demo}.local\`)"
  pgadmin:
    image: dpage/pgadmin4
    profiles: [debug]
    ports: ["127.0.0.1:5050:80"]
`);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ name: "app", build: "./app", mounts: ["app"], hosts: ["${SUB:-demo}.local"] });
    expect(s[1]).toMatchObject({ name: "pgadmin", profiles: ["debug"], ports: ["127.0.0.1:5050:80"] });
  });

  it("returns [] for invalid yaml", () => {
    expect(parseCompose("services: [")).toEqual([]);
  });
});

describe("detect", () => {
  let root: string;
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "aurora-detect-"));
    const w = async (rel: string, body: string) => {
      await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true });
      await fs.writeFile(path.join(root, rel), body);
    };
    await w("README.md", "# Demo App\n\nA tiny demo used in tests.\n");
    await w(
      "compose.yml",
      `services:
  app: { build: ./app, volumes: ["./app:/app"] }
  api: { build: ./api, volumes: ["./api:/app"] }
  postgres: { image: "postgres:17-alpine" }
`,
    );
    await w(".docker/app/Dockerfile", "FROM node:26.9.0-alpine3.24 AS dev\n");
    await w(
      "app/package.json",
      JSON.stringify({
        scripts: { test: "vitest run", coverage: "vitest run --coverage", "test:e2e": "playwright test", "test:watch": "vitest" },
        dependencies: { react: "^19.2.0", "vite-plugin-pwa": "^1.0.0", "@react-oauth/google": "^0.12.0" },
        devDependencies: { vitest: "^5.0.0", "@playwright/test": "^1.60.0" },
      }),
    );
    await w("app/public/favicon.svg", "<svg/>");
    await w("app/src/pages/AdminPage.tsx", "export {}");
    await w("api/requirements.txt", "fastapi==0.142.2\nuvicorn[standard]>=0.54\npytest==8.4.0\npytest-cov\n");
    await w(".github/workflows/ci.yml", "on: push\n");
    await w("scripts/backup.sh", "pg_dump");
  });
  afterAll(() => fs.rm(root, { recursive: true, force: true }));

  it("finds tools with versions", async () => {
    const d = await detect(root);
    const v = Object.fromEntries(d.tools.map((t) => [t.id, t.version]));
    expect(v.react).toBe("19.2.0");
    expect(v.nodedotjs).toBe("26.9.0");
    expect(v.alpinelinux).toBe("3.24");
    expect(v.postgresql).toBe("17");
    expect(v.fastapi).toBe("0.142.2");
    expect(d.tools.map((t) => t.id)).toEqual(expect.arrayContaining(["docker", "compose", "githubactions", "pytest", "vitest", "playwright"]));
    // sorted by rank: frameworks first
    expect(d.tools[0].category).toBe("framework");
  });

  it("detects features", async () => {
    const d = await detect(root);
    expect(d.features).toMatchObject({ pwa: true, socialLogin: true, admin: true, backup: true, ci: true, tests: true, e2e: true, docker: true });
    expect(d.features.i18n).toBeUndefined();
  });

  it("maps test scripts to compose services and skips watch scripts", async () => {
    const d = await detect(root);
    const ids = d.tests.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["app:test", "app:coverage", "app:test:e2e", "api:pytest", "api:pytest-cov"]));
    expect(ids).not.toContain("app:test:watch");
    expect(d.tests.find((t) => t.id === "app:test")).toMatchObject({ service: "app", runner: "Vitest", kind: "unit" });
    expect(d.tests.find((t) => t.id === "app:test:e2e")).toMatchObject({ kind: "e2e", runner: "Playwright" });
    expect(d.tests.find((t) => t.id === "api:pytest")).toMatchObject({ service: "api", command: ["pytest", "-q"] });
  });

  it("reads readme and icon", async () => {
    const d = await detect(root);
    expect(d.readme).toEqual({ title: "Demo App", summary: "A tiny demo used in tests." });
    expect(d.icon).toBe("app/public/favicon.svg");
  });
});
