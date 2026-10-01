import { Globe, Monitor } from "lucide-react";
import type { LocalState, ProdState, ProjectStatus, StatusSource } from "../types";
import { cx } from "./ui";

const LOCAL: Record<LocalState, { label: string; dot: string; text: string }> = {
  running: { label: "Running", dot: "bg-nord14", text: "text-nord14" },
  partial: { label: "Partial", dot: "bg-nord13", text: "text-nord13" },
  stopped: { label: "Stopped", dot: "bg-nord3", text: "text-nord4/70" },
  unknown: { label: "Unknown", dot: "bg-nord3/60", text: "text-nord4/50" },
};
const PROD: Record<ProdState, { label: string; dot: string; text: string }> = {
  up: { label: "Up", dot: "bg-nord14", text: "text-nord14" },
  down: { label: "Down", dot: "bg-nord11", text: "text-nord11" },
  unknown: { label: "Checking", dot: "bg-nord3", text: "text-nord4/60" },
  none: { label: "No URL", dot: "bg-nord3/60", text: "text-nord4/50" },
};

function Pill({ icon, label, dot, text, pulse, title }: { icon: React.ReactNode; label: string; dot: string; text: string; pulse?: boolean; title: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2 h-6 text-[11px] bg-nord0/60 border border-white/[0.08] backdrop-blur-md">
      <span className={cx("size-2 rounded-full", dot, pulse && "pulse-dot", text)} />
      <span className="text-nord4/60">{icon}</span>
      <span className={text}>{label}</span>
    </span>
  );
}

/** Status per the project's configured source (local, prod or both). Always icon + label, never color alone. */
export function StatusPills({ status, source }: { status?: ProjectStatus; source: StatusSource }) {
  const local = LOCAL[status?.local ?? "unknown"];
  const prod = PROD[status?.prod ?? "none"];
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {source !== "prod" && (
        <Pill icon={<Monitor size={11} />} {...local} pulse={status?.local === "running"} title={`Local: ${local.label}`} />
      )}
      {source !== "local" && (
        <Pill
          icon={<Globe size={11} />}
          {...prod}
          title={`Production: ${prod.label}${status?.prodCode ? ` (HTTP ${status.prodCode}, ${status.prodLatencyMs} ms)` : ""}`}
        />
      )}
    </span>
  );
}

export function StatusDot({ status }: { status?: ProjectStatus }) {
  const s = LOCAL[status?.local ?? "unknown"];
  return <span title={s.label} aria-label={s.label} className={cx("inline-block size-2 rounded-full shrink-0", s.dot)} />;
}

export const localLabel = (s?: LocalState) => LOCAL[s ?? "unknown"].label;
