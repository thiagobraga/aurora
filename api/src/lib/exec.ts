import { execFile, spawn, type ChildProcess } from "node:child_process";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a binary with an argument array (never through a shell). */
export function run(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: opts.cwd, timeout: opts.timeout ?? 30_000, maxBuffer: 32 * 1024 * 1024, env: { ...process.env, ...opts.env } },
      (err, stdout, stderr) => {
        const code = err ? (typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1) : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr || (err && !stdout ? err.message : "")) });
      },
    );
  });
}

export function stream(
  cmd: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; cleanEnv?: boolean },
  onData: (chunk: string) => void,
): { child: ChildProcess; done: Promise<number> } {
  // cleanEnv: don't leak Aurora's own variables (PORT, tokens) into a
  // project's compose interpolation, which prefers the shell env over .env.
  const base = opts.cleanEnv ? { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: process.env.DOCKER_HOST } : process.env;
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    env: { ...base, FORCE_COLOR: "1", CI: "1", ...opts.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (b: Buffer) => onData(b.toString()));
  child.stderr?.on("data", (b: Buffer) => onData(b.toString()));
  const done = new Promise<number>((resolve) => {
    child.on("error", (e) => {
      onData(`\n[aurora] ${e.message}\n`);
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
  return { child, done };
}
