import { config } from "../config.js";
import { run } from "../lib/exec.js";

const git = (cwd: string, args: string[]) => run("git", ["-c", "safe.directory=*", ...args], { cwd, timeout: 10_000 });

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
  avatar?: string;
}

/** git@github.com:owner/repo.git | https://github.com/owner/repo(.git) -> owner/repo */
export function githubSlug(remote?: string): string | undefined {
  const m = remote?.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : undefined;
}

export async function gitInfo(root: string) {
  const [branch, remote, status, last] = await Promise.all([
    git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    git(root, ["remote", "get-url", "origin"]),
    git(root, ["status", "--porcelain", "--untracked-files=no"]),
    git(root, ["log", "-1", "--format=%cI"]),
  ]);
  if (branch.code !== 0) return {};
  const remoteUrl = remote.code === 0 ? remote.stdout.trim() : undefined;
  return {
    branch: branch.stdout.trim(),
    remote: remoteUrl,
    github: githubSlug(remoteUrl),
    dirty: status.stdout.trim().length > 0,
    lastCommitAt: last.stdout.trim() || undefined,
  };
}

export async function localCommits(root: string, limit = 15): Promise<Commit[]> {
  const r = await git(root, ["log", `-n${limit}`, "--format=%H%x1f%an%x1f%aI%x1f%s"]);
  if (r.code !== 0) return [];
  return r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [sha, author, date, message] = l.split("\x1f");
      return { sha, author, date, message };
    });
}

const cache = new Map<string, { at: number; data: Commit[] }>();

export async function githubCommits(slug: string, limit = 15): Promise<Commit[] | undefined> {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.data;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "aurora" };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${slug}/commits?per_page=${limit}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Array<{
      sha: string;
      html_url: string;
      commit: { message: string; author: { name: string; date: string } };
      author?: { avatar_url?: string; login?: string } | null;
    }>;
    const data = body.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      author: c.author?.login ?? c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url,
      avatar: c.author?.avatar_url,
    }));
    cache.set(slug, { at: Date.now(), data });
    return data;
  } catch {
    return undefined;
  }
}

export async function initRepo(root: string, message: string) {
  const id = ["-c", `user.name=${config.gitUserName}`, "-c", `user.email=${config.gitUserEmail}`];
  if ((await git(root, ["rev-parse", "--git-dir"])).code === 0) return;
  await git(root, ["init", "-q", "-b", "main"]);
  await git(root, ["add", "-A"]);
  await git(root, [...id, "commit", "-q", "-m", message]);
}
