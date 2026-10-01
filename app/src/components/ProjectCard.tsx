import { Link } from "react-router";
import { Ellipsis, Star } from "lucide-react";
import { assetUrl } from "../api/client";
import { useToggleFavorite } from "../api/hooks";
import { ToolIcon } from "../lib/icons";
import { useUI } from "../lib/ui";
import type { Project, ProjectStatus, Tool } from "../types";
import { Cover } from "./Cover";
import { StatusPills } from "./StatusPill";
import { cx } from "./ui";

const BADGE_CATEGORIES = new Set(["framework", "runtime", "database", "infra", "language", "styling"]);

/** The few tools worth a badge on a card: frameworks, runtimes, databases, Docker. */
export function primaryTools(tools: Tool[], n = 4): Tool[] {
  return tools.filter((t) => BADGE_CATEGORIES.has(t.category)).slice(0, n);
}

export function ToolBadge({ tool, compact }: { tool: Tool; compact?: boolean }) {
  return (
    <span
      title={`${tool.name}${tool.version ? ` ${tool.version}` : ""} · ${tool.source}`}
      className="inline-flex items-center gap-1.5 h-6 rounded-md px-1.5 text-[11px] bg-nord0/55 border border-white/[0.08] text-nord5 backdrop-blur-md"
    >
      <ToolIcon id={tool.id} category={tool.category} size={12} />
      {!compact && <span className="truncate max-w-24">{tool.name}</span>}
      {tool.version && <span className="text-nord4/55">{tool.version.split(".").slice(0, 2).join(".")}</span>}
    </span>
  );
}

export function ProjectIcon({ project, size = 28 }: { project: Project; size?: number }) {
  if (project.hasIcon)
    return (
      <img
        src={assetUrl(`/projects/${project.slug}/icon`)}
        alt=""
        width={size}
        height={size}
        className="rounded-lg bg-nord0/60 p-1 object-contain shrink-0"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="grid place-items-center rounded-lg bg-linear-to-br from-nord10 to-nord15 font-display text-nord6 shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {project.manifest.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ProjectCard({ project, status, favorite }: { project: Project; status?: ProjectStatus; favorite: boolean }) {
  const ui = useUI();
  const toggleFav = useToggleFavorite();
  const tools = primaryTools(project.tools);
  const m = project.manifest;

  return (
    <article
      onContextMenu={(e) => ui.openMenu(e, project)}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.07] shadow-[0_18px_40px_-20px_rgb(0_0_0/0.7)] transition hover:-translate-y-0.5 hover:border-nord8/30 hover:shadow-[0_24px_50px_-20px_rgb(94_129_172/0.45)] focus-within:border-nord8/40"
    >
      <Cover project={project} className="h-64">
        <Link to={`/projects/${project.slug}`} className="absolute inset-0 z-0" aria-label={`Open ${m.name}`} />

        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
          <span className="pointer-events-auto">
            <StatusPills status={status} source={m.statusSource} />
          </span>
          <span className="flex gap-1 pointer-events-auto">
            <button
              type="button"
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={favorite}
              onClick={() => toggleFav(project.slug)}
              className={cx(
                "size-7 grid place-items-center rounded-lg backdrop-blur-md border border-white/[0.08] transition",
                favorite ? "bg-nord13/20 text-nord13" : "bg-nord0/50 text-nord4/70 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-nord13",
              )}
            >
              <Star size={14} fill={favorite ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              aria-label="Actions"
              onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                ui.openMenu({ clientX: r.right - 200, clientY: r.bottom + 6 }, project);
              }}
              className="size-7 grid place-items-center rounded-lg bg-nord0/50 text-nord4/80 backdrop-blur-md border border-white/[0.08] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-nord6 transition"
            >
              <Ellipsis size={15} />
            </button>
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-4 space-y-2.5 z-10 pointer-events-none">
          <div className="flex items-center gap-2.5">
            <ProjectIcon project={project} size={26} />
            <h3 className="font-display text-[15px] text-nord6 text-shadow truncate">{m.name}</h3>
          </div>
          {m.description && <p className="text-xs text-nord5/85 text-shadow line-clamp-2 leading-relaxed">{m.description}</p>}
          {m.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {m.tags.slice(0, 4).map((t) => (
                <span key={t} className="text-[10px] uppercase tracking-wider text-nord8/90 text-shadow">
                  #{t}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 pointer-events-auto">
            {tools.map((t) => (
              <ToolBadge key={t.id} tool={t} compact={tools.length > 3} />
            ))}
            {project.tools.length > 0 && (
              <button
                type="button"
                onClick={() => ui.openDialog("tools", project)}
                aria-label={`All ${project.tools.length} tools`}
                title={`All ${project.tools.length} tools`}
                className="h-6 px-1.5 rounded-md text-[11px] inline-flex items-center gap-1 bg-nord0/55 border border-white/[0.08] text-nord4/80 hover:text-nord6 hover:border-nord8/40 backdrop-blur-md transition"
              >
                <Ellipsis size={13} />
                {project.tools.length > tools.length && <span>+{project.tools.length - tools.length}</span>}
              </button>
            )}
          </div>
        </div>
      </Cover>
    </article>
  );
}
