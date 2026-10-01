import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Columns3, Globe, Monitor, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { keys, useToggleFavorite } from "../api/hooks";
import { ago } from "../lib/format";
import { GithubIcon, ToolIcon } from "../lib/icons";
import { useUI } from "../lib/ui";
import { FEATURES, type FeatureKey, type Project, type ProjectStatus, type Tool } from "../types";
import { ProjectIcon } from "./ProjectCard";
import { StatusPills } from "./StatusPill";
import { BoolIcon, cx } from "./ui";

type Ctx = { p: Project; st?: ProjectStatus };

function ToolCell({ tools }: { tools: (Tool | undefined)[] }) {
  const list = tools.filter((t): t is Tool => !!t);
  if (!list.length) return <span className="text-nord3">–</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {list.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`${t.name} ${t.version ?? ""}`}>
          <ToolIcon id={t.id} category={t.category} size={13} />
          <span className="text-nord5">{t.name}</span>
          {t.version && <span className="text-nord4/50 tabular-nums">{t.version}</span>}
        </span>
      ))}
    </span>
  );
}

const tool = (p: Project, id: string) => p.tools.find((t) => t.id === id);

function LinkIcon({ href, label, children }: { href?: string; label: string; children: ReactNode }) {
  if (!href) return <span className="size-7 grid place-items-center text-nord3/50" aria-hidden>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener" title={`${label}: ${href}`} aria-label={label} className="size-7 grid place-items-center rounded-md text-nord4/80 hover:text-nord8 hover:bg-white/[0.06]">
      {children}
    </a>
  );
}

export const COLUMNS: { id: string; label: string; render: (c: Ctx) => ReactNode }[] = [
  { id: "status", label: "Status", render: ({ p, st }) => <StatusPills status={st} source={p.manifest.statusSource} /> },
  { id: "framework", label: "Framework", render: ({ p }) => <ToolCell tools={p.tools.filter((t) => t.category === "framework").slice(0, 2)} /> },
  { id: "node", label: "Node", render: ({ p }) => <ToolCell tools={[tool(p, "nodedotjs")]} /> },
  { id: "python", label: "Python", render: ({ p }) => <ToolCell tools={[tool(p, "python")]} /> },
  { id: "react", label: "React", render: ({ p }) => <ToolCell tools={[tool(p, "react")]} /> },
  { id: "typescript", label: "TypeScript", render: ({ p }) => <ToolCell tools={[tool(p, "typescript")]} /> },
  { id: "docker", label: "Base", render: ({ p }) => <ToolCell tools={[tool(p, "docker"), tool(p, "alpinelinux") ?? tool(p, "debian")]} /> },
  { id: "database", label: "Database", render: ({ p }) => <ToolCell tools={p.tools.filter((t) => t.category === "database" && t.id !== "pgadmin")} /> },
  {
    id: "tests",
    label: "Tests",
    render: ({ p }) =>
      p.tests.length ? (
        <span className="text-nord5">
          {p.tests.filter((t) => t.kind !== "coverage").length}{" "}
          <span className="text-nord4/50">{[...new Set(p.tests.map((t) => t.runner))].join(" · ")}</span>
        </span>
      ) : (
        <span className="text-nord3">–</span>
      ),
  },
  {
    id: "coverage",
    label: "Coverage",
    render: ({ p }) => {
      const c = p.coverage.find((x) => x.lines !== undefined);
      if (!c) return <span className="text-nord3">–</span>;
      return <span className={cx("tabular-nums", c.lines! >= 80 ? "text-nord14" : c.lines! >= 50 ? "text-nord13" : "text-nord11")}>{c.lines}%</span>;
    },
  },
  {
    id: "containers",
    label: "Containers",
    render: ({ st }) => (st?.containers.length ? <span className="tabular-nums">{st.containers.filter((c) => c.state === "running").length}/{st.containers.length}</span> : <span className="text-nord3">–</span>),
  },
  { id: "tags", label: "Tags", render: ({ p }) => <span className="text-nord8/80">{p.manifest.tags.map((t) => `#${t}`).join(" ") || <span className="text-nord3">–</span>}</span> },
  { id: "branch", label: "Branch", render: ({ p }) => <span className="text-nord4/80">{p.git.branch ?? "–"}{p.git.dirty && <span className="text-nord13"> *</span>}</span> },
  { id: "updated", label: "Updated", render: ({ p }) => <span className="text-nord4/70 whitespace-nowrap">{ago(p.updatedAt)}</span> },
  {
    id: "links",
    label: "Links",
    render: ({ p }) => (
      <span className="inline-flex">
        <LinkIcon href={p.links.local} label="Local app"><Monitor size={14} /></LinkIcon>
        <LinkIcon href={p.links.prod} label="Production"><Globe size={14} /></LinkIcon>
        <LinkIcon href={p.links.github} label="GitHub"><GithubIcon size={14} /></LinkIcon>
      </span>
    ),
  },
];

export function ColumnPicker({ all, selected, onChange, label = "Columns" }: { all: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-8 px-3 inline-flex items-center gap-2 rounded-lg text-xs bg-nord0/50 border border-white/[0.07] text-nord4/80 hover:text-nord6"
      >
        <Columns3 size={14} /> {label}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-52 glass-strong rounded-xl p-1.5">
          {all.map((c) => (
            <label key={c.id} className="flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-nord5 hover:bg-white/[0.06] cursor-pointer">
              <input
                type="checkbox"
                className="accent-nord8"
                checked={selected.includes(c.id)}
                onChange={(e) => onChange(e.target.checked ? all.map((x) => x.id).filter((id) => id === c.id || selected.includes(id)) : selected.filter((x) => x !== c.id))}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const th = "px-3 py-2.5 text-left text-[10px] font-normal uppercase tracking-[0.14em] text-nord4/55 whitespace-nowrap";
const td = "px-3 py-2.5 text-[12px] align-middle";

export function ProjectTable({
  projects,
  status,
  columns,
  favorites,
}: {
  projects: Project[];
  status: Record<string, ProjectStatus>;
  columns: string[];
  favorites: string[];
}) {
  const ui = useUI();
  const toggleFav = useToggleFavorite();
  const cols = COLUMNS.filter((c) => columns.includes(c.id));
  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full border-collapse min-w-[720px]">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <th className={cx(th, "w-10")}><span className="sr-only">Favorite</span></th>
            <th className={th}>
              Project
            </th>
            {cols.map((c) => (
              <th key={c.id} className={th}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.slug} onContextMenu={(e) => ui.openMenu(e, p)} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition">
              <td className={cx(td, "pl-4")}>
                <button type="button" aria-label="Toggle favorite" aria-pressed={favorites.includes(p.slug)} onClick={() => toggleFav(p.slug)} className={favorites.includes(p.slug) ? "text-nord13" : "text-nord3 hover:text-nord13"}>
                  <Star size={14} fill={favorites.includes(p.slug) ? "currentColor" : "none"} />
                </button>
              </td>
              <td className={td}>
                <Link to={`/projects/${p.slug}`} className="flex items-center gap-3 min-w-0 group">
                  <ProjectIcon project={p} size={30} />
                  <span className="min-w-0">
                    <span className="block text-[13px] text-nord6 group-hover:text-nord8 truncate max-w-64">{p.manifest.name}</span>
                    <span className="block text-[11px] text-nord4/50 truncate max-w-64">{p.manifest.description || p.slug}</span>
                  </span>
                </Link>
              </td>
              {cols.map((c) => (
                <td key={c.id} className={td}>{c.render({ p, st: status[p.slug] })}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Large project × feature grid. Click a cell to override detection; Alt+click to reset. */
export function FeatureMatrix({ projects, columns }: { projects: Project[]; columns: string[] }) {
  const qc = useQueryClient();
  const feats = FEATURES.filter((f) => columns.includes(f.key));

  const toggle = async (p: Project, key: FeatureKey, reset: boolean) => {
    const next = { ...p.manifest.features };
    if (reset) delete next[key];
    else next[key] = !p.features[key].value;
    await api(`/projects/${p.slug}`, { method: "PATCH", json: { features: next } });
    qc.invalidateQueries({ queryKey: keys.projects });
  };

  return (
    <div className="glass rounded-2xl overflow-x-auto">
      <table className="w-full border-collapse min-w-[720px]">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <th className={th}>Project</th>
            {feats.map((f) => (
              <th key={f.key} className={cx(th, "text-center")}>{f.label}</th>
            ))}
            <th className={cx(th, "text-right")}>Score</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const score = feats.filter((f) => p.features[f.key].value).length;
            return (
              <tr key={p.slug} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03]">
                <td className={td}>
                  <Link to={`/projects/${p.slug}`} className="flex items-center gap-2.5 hover:text-nord8">
                    <ProjectIcon project={p} size={22} />
                    <span className="text-nord6 truncate max-w-56">{p.manifest.name}</span>
                  </Link>
                </td>
                {feats.map((f) => (
                  <td key={f.key} className={cx(td, "text-center")}>
                    <button
                      type="button"
                      onClick={(e) => void toggle(p, f.key, e.altKey)}
                      aria-label={`${f.label}: ${p.features[f.key].value ? "yes" : "no"}. Click to toggle.`}
                      className="rounded-full hover:scale-110 transition"
                    >
                      <BoolIcon value={p.features[f.key].value} manual={p.features[f.key].source === "manual"} />
                    </button>
                  </td>
                ))}
                <td className={cx(td, "text-right tabular-nums text-nord4/70")}>
                  {score}/{feats.length}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2.5 text-[11px] text-nord4/45 border-t border-white/[0.05] flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-nord13" /> set manually · click toggles · Alt+click returns to auto-detection
      </p>
    </div>
  );
}
