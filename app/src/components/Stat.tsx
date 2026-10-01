import type { ReactNode } from "react";
import { cx } from "./ui";

/** Tiny inline sparkline for stat tiles. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8" />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-8" aria-hidden>
      <polyline points={`0,32 ${pts} 100,32`} fill={color} fillOpacity={0.1} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function StatTile({ label, value, sub, icon, children, className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cx("glass rounded-2xl p-4 flex flex-col gap-1 min-w-0", className)}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-nord4/60">
        {icon}
        {label}
      </div>
      <div className="font-display text-2xl text-nord6 tabular-nums tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-nord4/55 truncate">{sub}</div>}
      {children}
    </div>
  );
}

/** Usage bar (disk, memory): one filled track, value labeled outside. */
export function Meter({ value, max, color = "#88C0D0" }: { value: number; max: number; color?: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-nord0/70 overflow-hidden" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
