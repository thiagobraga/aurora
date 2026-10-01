import express from "express";

export function createApp(deps: { dbHealthy: () => Promise<boolean> }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/v1/health", async (_req, res) => {
    res.json({ ok: true, db: await deps.dbHealthy() });
  });

  return app;
}
