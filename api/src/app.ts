import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "./config.js";
import { AppError } from "./lib/errors.js";
import { projects } from "./routes/projects.js";
import { system } from "./routes/system.js";

/** Optional shared-secret auth (AURORA_TOKEN). Query param is for <img src>. */
export const auth: RequestHandler = (req, res, next) => {
  if (!config.token || req.path === "/health") return next();
  const header = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (header === config.token || req.query.token === config.token) return next();
  res.status(401).json({ error: { code: "unauthorized", message: "Missing or invalid token" } });
};

const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) return void res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if (err instanceof ZodError)
    return void res.status(400).json({ error: { code: "validation", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), details: err.issues } });
  if (err?.code === "LIMIT_FILE_SIZE") return void res.status(413).json({ error: { code: "too_large", message: "File too large" } });
  if (err?.name === "MulterError") return void res.status(400).json({ error: { code: "upload", message: err.message } });
  console.error(err);
  res.status(500).json({ error: { code: "internal", message: "Internal error" } });
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/v1", auth, system, projects);
  app.use(errors);
  return app;
}
