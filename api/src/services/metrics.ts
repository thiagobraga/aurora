import fs from "node:fs/promises";
import os from "node:os";
import { config } from "../config.js";
import { hub } from "./status.js";

export interface Sample {
  t: number;
  cpu: number;
  memUsed: number;
  memTotal: number;
  load1: number;
  containersRunning: number;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  kernel: string;
  cpus: number;
  cpuModel: string;
  uptime: number;
  disk?: { total: number; free: number; path: string };
}

const MAX = 180; // 15 min at 5s
const samples: Sample[] = [];
let prev = cpuTimes();

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { idle, total };
}

/** Memory "used" the way `free` reports it (MemTotal - MemAvailable), not total - free. */
async function memory(): Promise<{ used: number; total: number }> {
  try {
    const txt = await fs.readFile("/proc/meminfo", "utf8");
    const kb = (k: string) => Number(txt.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? 0) * 1024;
    const total = kb("MemTotal");
    return { total, used: total - kb("MemAvailable") };
  } catch {
    return { total: os.totalmem(), used: os.totalmem() - os.freemem() };
  }
}

export async function sample(): Promise<Sample> {
  const now = cpuTimes();
  const dt = now.total - prev.total;
  const cpu = dt > 0 ? Math.max(0, Math.min(100, 100 * (1 - (now.idle - prev.idle) / dt))) : 0;
  prev = now;
  const mem = await memory();
  const s: Sample = {
    t: Date.now(),
    cpu: Math.round(cpu * 10) / 10,
    memUsed: mem.used,
    memTotal: mem.total,
    load1: Math.round(os.loadavg()[0] * 100) / 100,
    containersRunning: hub.containers.filter((c) => c.state === "running").length,
  };
  samples.push(s);
  if (samples.length > MAX) samples.shift();
  return s;
}

export const history = () => samples;

export async function systemInfo(): Promise<SystemInfo> {
  let disk: SystemInfo["disk"];
  try {
    const st = await fs.statfs(config.projectsDir);
    disk = { total: st.blocks * st.bsize, free: st.bavail * st.bsize, path: config.projectsDir };
  } catch {
    /* ignore */
  }
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    platform: `${os.type()} ${os.arch()}`,
    kernel: os.release(),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model ?? "",
    uptime: os.uptime(),
    disk,
  };
}
