import { Router } from "express";
import { isDockerAvailable } from "../services/docker.js";
import { history, systemInfo } from "../services/metrics.js";
import { getState, patchState, StatePatchSchema } from "../services/state.js";
import { hub } from "../services/status.js";

export const system = Router();

system.get("/health", (_req, res) => {
  res.json({ ok: true });
});

system.get("/system", async (_req, res) => {
  const statsByName = new Map(hub.lastStats.map((s) => [s.id, s]));
  const perProject = Object.entries(hub.status).map(([slug, st]) => ({
    slug,
    cpu: st.containers.reduce((n, c) => n + (statsByName.get(c.id)?.cpu ?? 0), 0),
    memBytes: st.containers.reduce((n, c) => n + (statsByName.get(c.id)?.memBytes ?? 0), 0),
    running: st.containers.filter((c) => c.state === "running").length,
  }));
  res.json({
    info: await systemInfo(),
    docker: isDockerAvailable(),
    history: history(),
    containers: { total: hub.containers.length, running: hub.containers.filter((c) => c.state === "running").length },
    perProject,
  });
});

system.get("/state", async (_req, res) => {
  res.json({ state: await getState() });
});

system.patch("/state", async (req, res) => {
  res.json({ state: await patchState(StatePatchSchema.parse(req.body)) });
});
