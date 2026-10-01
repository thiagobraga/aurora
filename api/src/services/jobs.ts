import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { stream } from "../lib/exec.js";

export interface Job {
  id: string;
  slug: string;
  kind: string;
  label: string;
  command: string;
  status: "running" | "success" | "failed";
  code?: number;
  startedAt: string;
  endedAt?: string;
  output: string;
}

export interface Step {
  cmd: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Run without Aurora's own environment variables. */
  cleanEnv?: boolean;
  /** Keep going with the next step even if this one fails. */
  allowFail?: boolean;
}

const MAX_OUTPUT = 400_000;
const MAX_JOBS = 100;

/** Background command runner; output is streamed to sockets via "output"/"end" events. */
class Jobs extends EventEmitter {
  jobs = new Map<string, Job>();

  list(slug?: string): Omit<Job, "output">[] {
    return [...this.jobs.values()]
      .filter((j) => !slug || j.slug === slug)
      .map(({ output: _o, ...j }) => j)
      .reverse();
  }

  get(id: string) {
    return this.jobs.get(id);
  }

  /** Runs steps sequentially. `fn` steps let callers mix in JS work (file copy, YAML edits). */
  start(
    meta: { slug: string; kind: string; label: string },
    steps: (Step | ((log: (s: string) => void) => Promise<void>))[],
    onDone?: (job: Job) => void,
  ): Job {
    const job: Job = {
      id: randomUUID(),
      ...meta,
      command: steps.map((s) => (typeof s === "function" ? "(internal)" : [s.cmd, ...s.args].join(" "))).join(" && "),
      status: "running",
      startedAt: new Date().toISOString(),
      output: "",
    };
    this.jobs.set(job.id, job);
    if (this.jobs.size > MAX_JOBS) this.jobs.delete(this.jobs.keys().next().value!);
    const log = (chunk: string) => {
      job.output = (job.output + chunk).slice(-MAX_OUTPUT);
      this.emit("output", { id: job.id, slug: job.slug, chunk });
    };
    this.emit("start", { ...job, output: undefined });

    void (async () => {
      let code = 0;
      for (const step of steps) {
        if (typeof step === "function") {
          try {
            await step(log);
          } catch (e) {
            log(`\n\x1b[31m✗ ${(e as Error).message}\x1b[0m\n`);
            code = 1;
            break;
          }
          continue;
        }
        log(`\x1b[36m$ ${[step.cmd, ...step.args].join(" ")}\x1b[0m\n`);
        const { done } = stream(step.cmd, step.args, { cwd: step.cwd, env: step.env, cleanEnv: step.cleanEnv }, log);
        const c = await done;
        if (c !== 0 && !step.allowFail) {
          code = c;
          break;
        }
      }
      job.code = code;
      job.status = code === 0 ? "success" : "failed";
      job.endedAt = new Date().toISOString();
      log(`\n${code === 0 ? "\x1b[32m✓ done" : `\x1b[31m✗ exited with ${code}`}\x1b[0m\n`);
      this.emit("end", { id: job.id, slug: job.slug, status: job.status, code });
      onDone?.(job);
    })();
    return job;
  }
}

export const jobs = new Jobs();
