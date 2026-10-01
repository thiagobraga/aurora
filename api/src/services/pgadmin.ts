import fs from "node:fs/promises";
import path from "node:path";
import YAML, { isMap, isSeq, type Document } from "yaml";
import { badRequest } from "../lib/errors.js";
import { exists, readText } from "../lib/fs.js";
import { envDefault, parseCompose } from "./detect.js";
import { hub } from "./status.js";
import { listProjects } from "./projects.js";

function envOf(doc: Document, service: string): Record<string, string> {
  const env = doc.getIn(["services", service, "environment"]);
  const out: Record<string, string> = {};
  if (isMap(env)) for (const it of env.items) out[String((it.key as { value?: unknown })?.value ?? it.key)] = envDefault(String((it.value as { value?: unknown })?.value ?? it.value ?? ""));
  else if (isSeq(env))
    for (const it of env.items) {
      const [k, ...v] = String((it as { value?: unknown }).value ?? it).split("=");
      out[k] = envDefault(v.join("="));
    }
  return out;
}

/** Host ports already taken by containers or declared in any project's compose. */
async function usedPorts(): Promise<Set<number>> {
  const used = new Set<number>();
  for (const c of hub.containers) for (const m of c.ports.matchAll(/:(\d+)->/g)) used.add(Number(m[1]));
  for (const p of await listProjects())
    for (const s of p.compose.services)
      for (const port of s.ports) {
        const parts = envDefault(port).split(":");
        if (parts.length >= 2) used.add(Number(parts[parts.length - 2]));
      }
  return used;
}

export async function freePort(start = 5050): Promise<number> {
  const used = await usedPorts();
  let p = start;
  while (used.has(p)) p++;
  return p;
}

/**
 * Adds a `pgadmin` service (profiles: [debug]) to the project's compose file,
 * auto-registering its Postgres service. The original file is backed up to
 * .aurora/backups/ first. Returns the service name and URL.
 */
export async function addPgadmin(root: string, composeFile: string): Promise<{ service: string; url: string }> {
  const file = path.join(root, composeFile);
  const src = await readText(file);
  if (src === undefined) throw badRequest("Compose file not readable");
  const services = parseCompose(src);
  const existing = services.find((s) => /pgadmin/.test(s.image ?? ""));
  if (existing) throw badRequest(`pgAdmin already configured as service "${existing.name}"`);
  const pg = services.find((s) => /(^|\/)(postgres|postgis)/.test(envDefault(s.image ?? "")));
  if (!pg) throw badRequest("No PostgreSQL service found in compose file");

  const doc = YAML.parseDocument(src);
  const env = envOf(doc, pg.name);
  const user = env.POSTGRES_USER || "postgres";
  const db = env.POSTGRES_DB || user;
  const port = await freePort();
  const networks = doc.getIn(["services", pg.name, "networks"]);

  const service: Record<string, unknown> = {
    image: "dpage/pgadmin4:latest",
    profiles: ["debug"],
    environment: {
      PGADMIN_DEFAULT_EMAIL: "admin@example.com",
      PGADMIN_DEFAULT_PASSWORD: "admin",
      PGADMIN_CONFIG_SERVER_MODE: "False",
      PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: "False",
    },
    ports: [`127.0.0.1:${port}:80`],
    volumes: ["./.docker/pgadmin/servers.json:/pgadmin4/servers.json:ro"],
    depends_on: [pg.name],
  };
  if (networks) service.networks = (networks as { toJSON(): unknown }).toJSON();

  const name = services.some((s) => s.name === "pgadmin") ? "pgadmin-debug" : "pgadmin";
  doc.setIn(["services", name], doc.createNode(service));

  const backupDir = path.join(root, ".aurora", "backups");
  await fs.mkdir(backupDir, { recursive: true });
  await fs.copyFile(file, path.join(backupDir, `${composeFile}.${new Date().toISOString().replace(/[:.]/g, "-")}`));
  await fs.writeFile(file, String(doc));

  const serversJson = path.join(root, ".docker", "pgadmin", "servers.json");
  if (!(await exists(serversJson))) {
    await fs.mkdir(path.dirname(serversJson), { recursive: true });
    await fs.writeFile(
      serversJson,
      JSON.stringify(
        {
          Servers: {
            "1": {
              Name: path.basename(root),
              Group: "Servers",
              Host: pg.name,
              Port: 5432,
              MaintenanceDB: db,
              Username: user,
              SSLMode: "prefer",
              Comment: "Registered by Aurora",
            },
          },
        },
        null,
        2,
      ) + "\n",
    );
  }
  return { service: name, url: `http://localhost:${port}` };
}
