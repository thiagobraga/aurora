import { BRANDS, type SimpleIcon } from "./brands";
import { Box, Database, FlaskConical, Layers, Server, Wrench } from "lucide-react";
import type { ToolCategory } from "../types";

/** Detection ids that have no simple-icons entry (or need a different one). */
const ALIASES: Record<string, string> = {
  "postgresql-client": "postgresql",
  "redis-client": "redis",
  reactnative: "react",
};

const FALLBACK: Partial<Record<ToolCategory, typeof Box>> = {
  database: Database,
  testing: FlaskConical,
  infra: Server,
  build: Wrench,
  library: Layers,
};

export function brandIcon(id: string): SimpleIcon | undefined {
  const key = ALIASES[id] ?? id;
  return BRANDS[key];
}

/** Lifts dark brand colors (Express, Next.js, GitHub...) so they read on Nord surfaces. */
function legible(hex: string): string {
  const n = Number.parseInt(hex, 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l < 0.35 ? "#D8DEE9" : `#${hex}`;
}

export function ToolIcon({ id, category, size = 14, mono = false, className = "" }: { id: string; category?: ToolCategory; size?: number; mono?: boolean; className?: string }) {
  const icon = brandIcon(id);
  if (!icon) {
    const Fallback = (category && FALLBACK[category]) ?? Box;
    return <Fallback size={size} className={className} aria-hidden />;
  }
  return (
    <svg role="img" aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className} fill={mono ? "currentColor" : legible(icon.hex)}>
      <path d={icon.path} />
    </svg>
  );
}

export function GithubIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg role="img" aria-hidden viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d={BRANDS.github.path} />
    </svg>
  );
}
