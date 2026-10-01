import path from "node:path";
import { EventEmitter } from "node:events";
import { config } from "../config.js";
import type { LocalState, ProjectStatus } from "../types.js";
import { isDockerAvailable, listContainers, stats, watchEvents, type RawContainer, type Stat } from "./docker.js";
import { listProjects } from "./projects.js";

/**
 * Single source of truth for runtime status. Polls docker (plus `docker
 * events` for instant updates) and prod URLs, and emits "status" with the
 * full map whenever anything changes.
 */
class StatusHub extends EventEmitter {
  status: Record<string, ProjectStatus> = {};
  containers: RawContainer[] = [];
  lastStats: Stat[] = [];
  private prod: Record<string, Pick<ProjectStatus, "prod" | "prodCode" | "prodLatencyMs">> = {};
  private timers: NodeJS.Timeout[] = [];
  private stopEvents?: () => void;
  private refreshing?: Promise<void>;

  start() {
    void this.refresh();
    void this.checkProd();
    this.timers.push(setInterval(() => void this.refresh(), config.statusInterval));
    this.timers.push(setInterval(() => void this.sampleStats(), config.statsInterval));
    this.timers.push(setInterval(() => void this.checkProd(), config.prodInterval));
    this.stopEvents = watchEvents(() => void this.refresh());
  }

  stop() {
    this.timers.forEach(clearInterval);
    this.stopEvents?.();
  }

  refresh(): Promise<void> {
    this.refreshing ??= this.doRefresh().finally(() => (this.refreshing = undefined));
    return this.refreshing;
  }

  private async doRefresh() {
    const [containers, projects] = await Promise.all([listContainers(), listProjects()]);
    this.containers = containers;
    const statsById = new Map(this.lastStats.map((s) => [s.id, s]));
    const next: Record<string, ProjectStatus> = {};
    for (const p of projects) {
      const root = path.join(config.projectsDir, p.slug);
      const mine = containers
        .filter((c) => c.workingDir === root)
        .map((c) => {
          const s = statsById.get(c.id);
          return { ...c, cpu: s?.cpu, memBytes: s?.memBytes };
        });
      // Containers of opt-in profiles (pgadmin, coverage) don't count towards "partial".
      const debugServices = new Set(p.compose.services.filter((s) => s.profiles.length).map((s) => s.name));
      const core = mine.filter((c) => !debugServices.has(c.service));
      const running = core.filter((c) => c.state === "running").length;
      const local: LocalState = !isDockerAvailable() || (!p.compose.file && !mine.length)
        ? "unknown"
        : running === 0
          ? "stopped"
          : running < Math.max(core.length, p.compose.services.filter((s) => !s.profiles.length).length)
            ? "partial"
            : "running";
      const prod = this.prod[p.slug] ?? { prod: p.links.prod ? "unknown" : "none" };
      next[p.slug] = {
        local,
        ...prod,
        containers: mine.map(({ project: _p, workingDir: _w, createdAt: _c, ...rest }) => rest),
        checkedAt: new Date().toISOString(),
      };
    }
    const changed = JSON.stringify(strip(next)) !== JSON.stringify(strip(this.status));
    this.status = next;
    if (changed) this.emit("status", this.status);
  }

  async sampleStats() {
    if (!this.listenerCount("status")) return;
    if (!this.containers.some((c) => c.state === "running")) return;
    this.lastStats = await stats();
    this.emit("stats", this.lastStats);
    await this.refresh();
    this.emit("status", this.status);
  }

  async checkProd() {
    const projects = await listProjects();
    await Promise.all(
      projects.map(async (p) => {
        if (!p.links.prod) {
          delete this.prod[p.slug];
          return;
        }
        const url = new URL(p.manifest.urls.healthPath ?? "/", p.links.prod).toString();
        const t0 = Date.now();
        try {
          const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
          this.prod[p.slug] = { prod: res.status < 500 ? "up" : "down", prodCode: res.status, prodLatencyMs: Date.now() - t0 };
        } catch {
          this.prod[p.slug] = { prod: "down", prodLatencyMs: Date.now() - t0 };
        }
      }),
    );
    await this.refresh();
  }
}

/** Ignore timestamps and live stats when deciding whether to broadcast. */
function strip(s: Record<string, ProjectStatus>) {
  return Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, { ...v, checkedAt: 0, prodLatencyMs: 0, containers: v.containers.map((c) => ({ ...c, cpu: 0, memBytes: 0 })) }]),
  );
}

export const hub = new StatusHub();
