import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { auroraDir, config } from "./config.js";
import { dockerAvailable } from "./services/docker.js";
import { jobs } from "./services/jobs.js";
import { sample } from "./services/metrics.js";
import { hub } from "./services/status.js";

await fs.mkdir(config.projectsDir, { recursive: true });
await fs.rm(path.join(auroraDir(), "tmp"), { recursive: true, force: true });

const app = createApp();
const server = createServer(app);
const io = new Server(server, { serveClient: false });

io.use((socket, next) => {
  if (!config.token || socket.handshake.auth?.token === config.token) return next();
  next(new Error("unauthorized"));
});

io.on("connection", (socket) => {
  socket.emit("status", hub.status);
  // Clients join job rooms to receive live output for jobs they are viewing.
  socket.on("job:subscribe", (id: string) => void socket.join(`job:${id}`));
  socket.on("job:unsubscribe", (id: string) => void socket.leave(`job:${id}`));
});

hub.on("status", (s) => io.emit("status", s));
hub.on("projects", () => io.emit("projects"));
jobs.on("start", (j) => io.emit("job:start", j));
jobs.on("output", (o: { id: string; chunk: string }) => io.to(`job:${o.id}`).emit("job:output", o));
jobs.on("end", (e) => io.emit("job:end", e));

setInterval(async () => io.emit("metrics", await sample()), 5000);
void sample();

const docker = await dockerAvailable();
console.log(`[aurora] projects: ${config.projectsDir} | docker: ${docker ? "ok" : "unavailable"}`);
hub.start();

server.listen(config.port, () => console.log(`[aurora] api listening on :${config.port}`));

for (const sig of ["SIGINT", "SIGTERM"] as const)
  process.on(sig, () => {
    hub.stop();
    server.close(() => process.exit(0));
  });
