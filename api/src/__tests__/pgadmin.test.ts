import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { config } from "../config.js";
import { addPgadmin } from "../services/pgadmin.js";

describe("addPgadmin", () => {
  it("adds a debug-profile pgadmin service, keeps comments and backs up the file", async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "aurora-pg-"));
    const root = path.join(parent, "shop");
    await fs.mkdir(root);
    config.projectsDir = parent;
    const src = `# my stack
services:
  db:
    image: postgres:17-alpine # keep me
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-shop}
      POSTGRES_DB: shopdb
    networks: [data]
networks:
  data:
`;
    await fs.writeFile(path.join(root, "compose.yml"), src);
    const { service, url } = await addPgadmin(root, "compose.yml");
    expect(service).toBe("pgadmin");
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);

    const out = await fs.readFile(path.join(root, "compose.yml"), "utf8");
    expect(out).toContain("# keep me");
    const doc = YAML.parse(out);
    expect(doc.services.pgadmin).toMatchObject({ profiles: ["debug"], depends_on: ["db"], networks: ["data"] });
    expect(doc.services.pgadmin.ports[0]).toMatch(/^127\.0\.0\.1:\d+:80$/);

    const servers = JSON.parse(await fs.readFile(path.join(root, ".docker/pgadmin/servers.json"), "utf8"));
    expect(servers.Servers["1"]).toMatchObject({ Host: "db", Username: "shop", MaintenanceDB: "shopdb" });
    expect(await fs.readdir(path.join(root, ".aurora/backups"))).toHaveLength(1);

    await expect(addPgadmin(root, "compose.yml")).rejects.toThrow(/already configured/);
    await fs.rm(parent, { recursive: true, force: true });
  });
});
