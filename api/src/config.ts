import path from "node:path";

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 4000),
  projectsDir: path.resolve(env.PROJECTS_DIR ?? path.join(process.cwd(), "projects")),
  token: env.AURORA_TOKEN ?? "",
  githubToken: env.GITHUB_TOKEN ?? "",
  localDomain: env.LOCAL_DOMAIN ?? "local",
  traefikEntrypoint: env.TRAEFIK_ENTRYPOINT ?? "websecure",
  gitUserName: env.GIT_USER_NAME ?? "Aurora",
  gitUserEmail: env.GIT_USER_EMAIL ?? "aurora@localhost",
  templatesDir: path.resolve(import.meta.dirname, "../templates"),
  /** Poll intervals (ms). docker events trigger extra refreshes in between. */
  statusInterval: Number(env.STATUS_INTERVAL ?? 10_000),
  statsInterval: Number(env.STATS_INTERVAL ?? 15_000),
  prodInterval: Number(env.PROD_INTERVAL ?? 60_000),
};

/** Aurora's own folder inside PROJECTS_DIR: state, trash. Never listed as a project. */
export const auroraDir = () => path.join(config.projectsDir, ".aurora");
