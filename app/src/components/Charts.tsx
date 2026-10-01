import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bytes } from "../lib/format";

// Chart specs: 2px lines, ~10% area wash, hairline solid grid, bars <= 24px with 4px rounded ends.
const GRID = "rgb(236 239 244 / 0.06)";
const AXIS = { fill: "rgb(216 222 233 / 0.5)", fontSize: 11, fontFamily: "JetBrains Mono Variable, monospace" };

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-[12px]">
      <div className="text-nord4/60 mb-1">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: r.color }} />
          <span className="text-nord4/80">{r.label}</span>
          <span className="ml-auto pl-4 text-nord6 tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Single-series time chart (the title names the series, so no legend). */
export function TimeArea<T extends { t: number }>({
  data,
  value,
  color,
  label,
  format,
  domain,
  ticks,
  height = 180,
}: {
  data: T[];
  value: (d: T) => number;
  color: string;
  label: string;
  format: (v: number) => string;
  domain?: [number, number];
  ticks?: number[];
  height?: number;
}) {
  const id = `g-${label.replace(/\W/g, "")}`;
  const rows = data.map((d) => ({ t: d.t, v: value(d) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} tick={AXIS} axisLine={false} tickLine={false} minTickGap={48} />
        <YAxis domain={domain ?? [0, "auto"]} ticks={ticks} tickFormatter={format} tick={AXIS} axisLine={false} tickLine={false} width={64} />
        <Tooltip
          cursor={{ stroke: "rgb(236 239 244 / 0.25)", strokeWidth: 1 }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox title={time(payload[0].payload.t)} rows={[{ label, value: format(payload[0].payload.v), color }]} />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${id})`}
          isAnimationActive={false}
          activeDot={{ r: 4, fill: color, stroke: "#2e3440", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for one measure across projects. */
export function MemoryBars({ data, color = "#88C0D0" }: { data: { name: string; value: number }[]; color?: string }) {
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }} barCategoryGap={8}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => bytes(v, 0)} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: "rgb(229 233 240 / 0.8)" }} axisLine={false} tickLine={false} width={120} />
        <Tooltip
          cursor={{ fill: "rgb(236 239 244 / 0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox title={String(payload[0].payload.name)} rows={[{ label: "Memory", value: bytes(payload[0].payload.value), color }]} />
            ) : null
          }
        />
        <Bar
          dataKey="value"
          barSize={18}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          label={{ position: "right", formatter: (v: unknown) => bytes(Number(v), 0), fill: "rgb(216 222 233 / 0.7)", fontSize: 11 }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

