import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Boxes, Cpu, Globe, LayoutGrid, List, MemoryStick, Plus, Search, Sparkles, Table2 } from "lucide-react";
import { useAppState, usePatchState, useProjects } from "../api/hooks";
import { Sparkline, StatTile } from "../components/Stat";
import { ProjectCard } from "../components/ProjectCard";
import { ColumnPicker, COLUMNS, FeatureMatrix, ProjectTable } from "../components/ProjectTable";
import { buttonClass, Empty, Segmented, inputCls } from "../components/ui";
import { bytes } from "../lib/format";
import { useLive } from "../lib/live";
import { useMetrics } from "../lib/metrics";
import { FEATURES, type Project, type ProjectStatus } from "../types";

const STATUS_ORDER = { running: 0, partial: 1, stopped: 2, unknown: 3 };

function sortProjects(list: Project[], sort: string, status: Record<string, ProjectStatus>) {
  const by = [...list];
  if (sort === "updated") by.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  else if (sort === "status") by.sort((a, b) => STATUS_ORDER[status[a.slug]?.local ?? "unknown"] - STATUS_ORDER[status[b.slug]?.local ?? "unknown"] || a.manifest.name.localeCompare(b.manifest.name));
  else by.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
  return by;
}

function matches(p: Project, q: string) {
  if (!q) return true;
  const hay = [p.manifest.name, p.slug, p.manifest.description, ...p.manifest.tags, ...p.tools.map((t) => t.name)].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => (w.startsWith("#") ? p.manifest.tags.some((t) => t.toLowerCase() === w.slice(1)) : hay.includes(w)));
}

export function Dashboard() {
  const { data, isLoading, error } = useProjects();
  const { data: st } = useAppState();
  const patch = usePatchState();
  const live = useLive();
  const { series, sample } = useMetrics();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"projects" | "features">("projects");

  const status = Object.keys(live.status).length ? live.status : (data?.status ?? {});
  const state = st?.state;
  const view = state?.view ?? "cards";
  const projects = useMemo(() => sortProjects((data?.projects ?? []).filter((p) => matches(p, q)), state?.sort ?? "name", status), [data, q, state?.sort, status]);
  const all = data?.projects ?? [];
  const running = all.filter((p) => status[p.slug]?.local === "running" || status[p.slug]?.local === "partial").length;
  const prodUp = all.filter((p) => status[p.slug]?.prod === "up").length;
  const prodTotal = all.filter((p) => p.links.prod).length;
  const last = series.at(-1);
  const tags = [...new Set(all.flatMap((p) => p.manifest.tags))].sort();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-nord6 tracking-tight">Projects</h1>
          <p className="text-xs text-nord4/60 mt-1">
            {all.length} projects · right-click any project for actions
          </p>
        </div>
        <Link to="/new" className={buttonClass("primary")}>
          <Plus size={15} /> New project
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Overview">
        <StatTile label="Projects" icon={<Boxes size={13} />} value={all.length} sub={`${running} running locally`} />
        <StatTile label="Production" icon={<Globe size={13} />} value={prodTotal ? `${prodUp}/${prodTotal}` : "–"} sub={prodTotal ? "sites responding" : "no prod URLs set"} />
        <StatTile label="CPU" icon={<Cpu size={13} />} value={`${last?.cpu.toFixed(0) ?? "–"}%`} sub={sample ? "sample data" : `load ${last?.load1 ?? "–"}`}>
          <Sparkline values={series.slice(-40).map((s) => s.cpu)} color="#88C0D0" />
        </StatTile>
        <StatTile
          label="Memory"
          icon={<MemoryStick size={13} />}
          value={last ? `${((last.memUsed / last.memTotal) * 100).toFixed(0)}%` : "–"}
          sub={last ? `${bytes(last.memUsed)} of ${bytes(last.memTotal)}` : undefined}
        >
          <Sparkline values={series.slice(-40).map((s) => s.memUsed)} color="#B48EAD" />
        </StatTile>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nord4/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, tool or #tag" aria-label="Search projects" className={`${inputCls} pl-9`} />
        </div>
        <select
          aria-label="Sort"
          value={state?.sort ?? "name"}
          onChange={(e) => patch.mutate({ sort: e.target.value as "name" })}
          className="h-9 rounded-lg bg-nord0/60 border border-white/[0.08] px-2 text-xs text-nord5"
        >
          <option value="name">Name</option>
          <option value="updated">Recently updated</option>
          <option value="status">Status</option>
        </select>
        <span className="flex-1" />
        {view === "list" && (
          <>
            <Segmented
              label="Table"
              value={tab}
              onChange={setTab}
              options={[
                { value: "projects", label: "Overview" },
                { value: "features", label: "Features" },
              ]}
            />
            {tab === "projects" ? (
              <ColumnPicker all={COLUMNS} selected={state?.listColumns ?? []} onChange={(listColumns) => patch.mutate({ listColumns })} />
            ) : (
              <ColumnPicker all={FEATURES.map((f) => ({ id: f.key, label: f.label }))} selected={state?.featureColumns ?? []} onChange={(featureColumns) => patch.mutate({ featureColumns })} />
            )}
          </>
        )}
        <Segmented
          label="View"
          value={view}
          onChange={(v) => patch.mutate({ view: v })}
          options={[
            { value: "cards", label: "Cards", icon: <LayoutGrid size={14} /> },
            { value: "list", label: "List", icon: <List size={14} /> },
          ]}
        />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {tags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setQ((cur) => (cur.includes(`#${t}`) ? cur.replace(`#${t}`, "").trim() : `${cur} #${t}`.trim()))}
              className={`h-6 px-2 rounded-md text-[11px] border transition ${q.includes(`#${t}`) ? "bg-nord8/20 border-nord8/40 text-nord8" : "bg-nord0/40 border-white/[0.06] text-nord4/70 hover:text-nord6"}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <Empty title="Can't reach the Aurora API">{String((error as Error).message)}</Empty>
      ) : isLoading ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 rounded-2xl glass animate-pulse" />
          ))}
        </div>
      ) : !projects.length ? (
        <Empty icon={<Sparkles size={28} />} title={all.length ? "No matches" : "No projects yet"}>
          {all.length ? "Try another search." : <>Create one from a template or drop a zip on the <Link className="text-nord8" to="/new">New project</Link> page.</>}
        </Empty>
      ) : view === "cards" ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} status={status[p.slug]} favorite={state?.favorites.includes(p.slug) ?? false} />
          ))}
        </div>
      ) : tab === "projects" ? (
        <ProjectTable projects={projects} status={status} columns={state?.listColumns ?? []} favorites={state?.favorites ?? []} />
      ) : (
        <FeatureMatrix projects={projects} columns={state?.featureColumns ?? []} />
      )}
      {view === "list" && tab === "features" && (
        <p className="text-[11px] text-nord4/40 flex items-center gap-1.5">
          <Table2 size={12} /> Features are detected from dependencies and files; overrides are saved in each project's .aurora/project.json.
        </p>
      )}
    </div>
  );
}
