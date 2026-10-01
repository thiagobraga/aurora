export type ToolCategory =
  | "language"
  | "runtime"
  | "framework"
  | "library"
  | "build"
  | "styling"
  | "testing"
  | "database"
  | "infra"
  | "ci";

export interface Tool {
  id: string;
  name: string;
  version?: string;
  category: ToolCategory;
  /** Relative file the tool was detected from. */
  source: string;
  /** Lower = shown first on cards. */
  rank: number;
}

export const FEATURE_KEYS = [
  "socialLogin",
  "pwa",
  "offline",
  "admin",
  "backup",
  "realtime",
  "i18n",
  "tests",
  "e2e",
  "ci",
  "docker",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureValue {
  value: boolean;
  source: "detected" | "manual";
}

export type StatusSource = "local" | "prod" | "both";

export interface Manifest {
  name: string;
  description: string;
  tags: string[];
  cover: {
    /** "file" = .aurora/cover.<ext>, otherwise an http(s) URL. */
    image?: string;
    position: { x: number; y: number };
    overlay: number;
  };
  statusSource: StatusSource;
  urls: {
    local?: string;
    prod?: string;
    github?: string;
    healthPath?: string;
    pgadmin?: string;
    coverage?: string;
  };
  features: Partial<Record<FeatureKey, boolean>>;
  createdAt?: string;
  template?: string;
  importedFrom?: string;
}

export interface ComposeService {
  name: string;
  image?: string;
  build?: string;
  profiles: string[];
  ports: string[];
  hosts: string[];
  /** Host-relative directories bind-mounted into the service (./app -> app). */
  mounts: string[];
}

export interface TestCommand {
  id: string;
  label: string;
  kind: "unit" | "e2e" | "coverage";
  runner: string;
  dir: string;
  /** Compose service that owns `dir`, used for `docker compose exec`. */
  service?: string;
  command: string[];
}

export interface ContainerInfo {
  id: string;
  name: string;
  service: string;
  state: string;
  health?: string;
  status: string;
  ports: string;
  image: string;
  cpu?: number;
  memBytes?: number;
}

export type LocalState = "running" | "partial" | "stopped" | "unknown";
export type ProdState = "up" | "down" | "unknown" | "none";

export interface ProjectStatus {
  local: LocalState;
  prod: ProdState;
  prodCode?: number;
  prodLatencyMs?: number;
  containers: ContainerInfo[];
  checkedAt: string;
}

export interface CoverageSummary {
  lines?: number;
  statements?: number;
  branches?: number;
  functions?: number;
  file: string;
  updatedAt: string;
}

export interface Project {
  slug: string;
  path: string;
  manifest: Manifest;
  tools: Tool[];
  features: Record<FeatureKey, FeatureValue>;
  compose: { file?: string; services: ComposeService[] };
  tests: TestCommand[];
  coverage: CoverageSummary[];
  git: { branch?: string; remote?: string; github?: string; dirty?: boolean; lastCommitAt?: string };
  hasCoverFile: boolean;
  /** Cover file mtime, used as a cache-busting version. */
  coverVersion?: number;
  hasIcon: boolean;
  links: { local?: string; prod?: string; github?: string; pgadmin?: string; coverage?: string };
  updatedAt: string;
}
