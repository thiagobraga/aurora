// Mirrors api/src/types.ts (kept in sync by hand; small surface).

export type ToolCategory = "language" | "runtime" | "framework" | "library" | "build" | "styling" | "testing" | "database" | "infra" | "ci";

export interface Tool {
  id: string;
  name: string;
  version?: string;
  category: ToolCategory;
  source: string;
  rank: number;
}

export const FEATURES = [
  { key: "socialLogin", label: "Social login" },
  { key: "pwa", label: "PWA" },
  { key: "offline", label: "Offline" },
  { key: "admin", label: "Admin" },
  { key: "backup", label: "Backup" },
  { key: "realtime", label: "Realtime" },
  { key: "i18n", label: "i18n" },
  { key: "tests", label: "Tests" },
  { key: "e2e", label: "E2E" },
  { key: "ci", label: "CI" },
  { key: "docker", label: "Docker" },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

export interface FeatureValue {
  value: boolean;
  source: "detected" | "manual";
}

export type StatusSource = "local" | "prod" | "both";

export interface Manifest {
  name: string;
  description: string;
  tags: string[];
  cover: { image?: string; position: { x: number; y: number }; overlay: number };
  statusSource: StatusSource;
  urls: { local?: string; prod?: string; github?: string; healthPath?: string; pgadmin?: string; coverage?: string };
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
  mounts: string[];
}

export interface TestCommand {
  id: string;
  label: string;
  kind: "unit" | "e2e" | "coverage";
  runner: string;
  dir: string;
  service?: string;
  command: string[];
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
  coverVersion?: number;
  hasIcon: boolean;
  links: { local?: string; prod?: string; github?: string; pgadmin?: string; coverage?: string };
  updatedAt: string;
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

export interface AppState {
  favorites: string[];
  view: "cards" | "list";
  listColumns: string[];
  featureColumns: string[];
  openFolderUrl: string;
  sidebarCollapsed: boolean;
  sort: "name" | "updated" | "status";
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
  avatar?: string;
}

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
  output?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  layers: string[];
  tools: string[];
  services: string[];
  tags: string[];
}

export interface Sample {
  t: number;
  cpu: number;
  memUsed: number;
  memTotal: number;
  load1: number;
  containersRunning: number;
}

export interface SystemResponse {
  info: {
    hostname: string;
    platform: string;
    kernel: string;
    cpus: number;
    cpuModel: string;
    uptime: number;
    disk?: { total: number; free: number; path: string };
  };
  docker: boolean;
  history: Sample[];
  containers: { total: number; running: number };
  perProject: { slug: string; cpu: number; memBytes: number; running: number }[];
}
