import { spawn } from "node:child_process";
import { run } from "../lib/exec.js";
import type { ContainerInfo } from "../types.js";

export interface RawContainer extends ContainerInfo {
  project?: string;
  workingDir?: string;
  createdAt: string;
}

let available: boolean | undefined;

export async function dockerAvailable(): Promise<boolean> {
  const r = await run("docker", ["version", "--format", "{{.Server.Version}}"], { timeout: 5000 });
  available = r.code === 0;
  return available;
}
export const isDockerAvailable = () => available ?? false;

export function parseLabels(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split(",")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

/** Parses `docker ps --format '{{json .}}'` output (one JSON object per line). */
export function parsePs(stdout: string): RawContainer[] {
  return stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => {
      const c = JSON.parse(l) as Record<string, string>;
      const labels = parseLabels(c.Labels ?? "");
      const health = c.Status?.match(/\((healthy|unhealthy|health: starting)\)/)?.[1];
      return {
        id: c.ID,
        name: c.Names,
        image: c.Image,
        state: c.State,
        status: c.Status,
        health,
        ports: c.Ports ?? "",
        service: labels["com.docker.compose.service"] ?? c.Names,
        project: labels["com.docker.compose.project"],
        workingDir: labels["com.docker.compose.project.working_dir"],
        createdAt: c.CreatedAt,
      };
    });
}

export async function listContainers(): Promise<RawContainer[]> {
  const r = await run("docker", ["ps", "-a", "--no-trunc", "--format", "{{json .}}"], { timeout: 10_000 });
  if (r.code !== 0) {
    available = false;
    return [];
  }
  available = true;
  return parsePs(r.stdout);
}

const UNITS: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KIB: 1024, MIB: 1024 ** 2, GIB: 1024 ** 3, TIB: 1024 ** 4 };
export function parseBytes(s: string): number {
  const m = s.trim().match(/^([\d.]+)\s*([a-z]+)$/i);
  return m ? Math.round(Number(m[1]) * (UNITS[m[2].toUpperCase()] ?? 1)) : 0;
}

export interface Stat {
  id: string;
  name: string;
  cpu: number;
  memBytes: number;
  memLimit: number;
}

export async function stats(): Promise<Stat[]> {
  const r = await run("docker", ["stats", "--no-stream", "--no-trunc", "--format", "{{json .}}"], { timeout: 20_000 });
  if (r.code !== 0) return [];
  return r.stdout
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => {
      const s = JSON.parse(l) as Record<string, string>;
      const [used, limit] = (s.MemUsage ?? "0B / 0B").split("/");
      return {
        id: s.ID ?? s.Container,
        name: s.Name,
        cpu: Number.parseFloat(s.CPUPerc) || 0,
        memBytes: parseBytes(used ?? "0B"),
        memLimit: parseBytes(limit ?? "0B"),
      };
    });
}

/** Spawns `docker events` and calls back (debounced) on container lifecycle changes. */
export function watchEvents(onChange: () => void): () => void {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let child: ReturnType<typeof spawn> | undefined;
  const start = () => {
    if (stopped) return;
    child = spawn("docker", ["events", "--filter", "type=container", "--format", "{{.Action}}"], { stdio: ["ignore", "pipe", "ignore"] });
    child.stdout?.on("data", (b: Buffer) => {
      if (!/start|stop|die|kill|destroy|create|health_status|pause|unpause|restart/.test(b.toString())) return;
      clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    });
    child.on("error", () => undefined);
    child.on("close", () => setTimeout(start, 15_000));
  };
  start();
  return () => {
    stopped = true;
    child?.kill();
  };
}
