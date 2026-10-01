import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { getToken } from "../api/client";
import { keys } from "../api/hooks";
import type { ProjectStatus, Sample } from "../types";

interface Live {
  connected: boolean;
  status: Record<string, ProjectStatus>;
  metrics: Sample[];
  socket?: Socket;
}

const Ctx = createContext<Live>({ connected: false, status: {}, metrics: [] });

/** One websocket for the whole app: project status, metrics and job events. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<Record<string, ProjectStatus>>({});
  const [metrics, setMetrics] = useState<Sample[]>([]);
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    const s = io({ path: "/socket.io", auth: { token: getToken() }, transports: ["websocket", "polling"] });
    setSocket(s);
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("status", (st: Record<string, ProjectStatus>) => setStatus(st));
    s.on("metrics", (m: Sample) => setMetrics((prev) => [...prev.slice(-179), m]));
    s.on("projects", () => {
      qc.invalidateQueries({ queryKey: keys.projects });
      qc.invalidateQueries({ queryKey: ["project"] });
    });
    s.on("job:start", () => qc.invalidateQueries({ queryKey: ["jobs"] }));
    s.on("job:end", (e: { slug: string }) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: keys.projects });
      qc.invalidateQueries({ queryKey: keys.project(e.slug) });
    });
    return () => {
      s.close();
    };
  }, [qc]);

  return <Ctx.Provider value={{ connected, status, metrics, socket }}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);

/** Live status for a project, falling back to the REST snapshot until the socket speaks. */
export function useStatus(slug: string, fallback?: Record<string, ProjectStatus>): ProjectStatus | undefined {
  const { status } = useLive();
  return status[slug] ?? fallback?.[slug];
}

/** Streams a job's output: REST snapshot first, then socket chunks. */
export function useJobOutput(jobId?: string) {
  const { socket } = useLive();
  const [output, setOutput] = useState("");
  const [state, setState] = useState<{ status: string; code?: number }>({ status: "running" });
  const seen = useRef(0);

  useEffect(() => {
    if (!jobId || !socket) return;
    setOutput("");
    setState({ status: "running" });
    seen.current = 0;
    let buffered = "";
    let snapshotDone = false;
    const onOut = (o: { id: string; chunk: string }) => {
      if (o.id !== jobId) return;
      if (!snapshotDone) buffered += o.chunk;
      else setOutput((p) => p + o.chunk);
    };
    const onEnd = (e: { id: string; status: string; code?: number }) => e.id === jobId && setState({ status: e.status, code: e.code });
    socket.on("job:output", onOut);
    socket.on("job:end", onEnd);
    socket.emit("job:subscribe", jobId);
    fetch(`/api/v1/jobs/${jobId}`, { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} })
      .then((r) => r.json())
      .then((d) => {
        snapshotDone = true;
        const snap: string = d?.job?.output ?? "";
        // Chunks that arrived while fetching may already be in the snapshot.
        setOutput(snap + (snap.endsWith(buffered) ? "" : buffered));
        if (d?.job && d.job.status !== "running") setState({ status: d.job.status, code: d.job.code });
      })
      .catch(() => {
        snapshotDone = true;
        setOutput(buffered);
      });
    return () => {
      socket.off("job:output", onOut);
      socket.off("job:end", onEnd);
      socket.emit("job:unsubscribe", jobId);
    };
  }, [jobId, socket]);

  return { output, ...state };
}
