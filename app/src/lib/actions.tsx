import { Database, FlaskConical, FolderOpen, Pencil, Play, RotateCw, ShieldCheck, Square, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { Project, ProjectStatus } from "../types";
import { GithubIcon } from "./icons";
import { useUI } from "./ui";

export interface ActionItem {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
  /** Draw a separator above this item. */
  group?: boolean;
}

/**
 * The single list of project actions, used by both the right-click context
 * menu and the project page toolbar, so they never drift apart.
 */
export function useProjectActions(p: Project, status?: ProjectStatus): ActionItem[] {
  const ui = useUI();
  const hasCompose = !!p.compose.file;
  const running = status?.local === "running" || status?.local === "partial";

  const fail = (e: unknown) => ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) });
  const job = (action: string, body?: unknown) =>
    api<{ jobId: string }>(`/projects/${p.slug}/actions/${action}`, { method: "POST", json: body ?? {} })
      .then((r) => {
        ui.showJob(r.jobId);
        ui.closeMenu();
      })
      .catch(fail);

  const items: ActionItem[] = [
    {
      id: "folder",
      label: "Folder",
      icon: <FolderOpen size={15} />,
      hint: "Copy path + open in editor",
      run: () =>
        api<{ path: string; url: string }>(`/projects/${p.slug}/actions/folder`, { method: "POST", json: {} })
          .then(async (r) => {
            ui.closeMenu();
            await navigator.clipboard?.writeText(r.path).catch(() => undefined);
            ui.toast({ kind: "info", text: `Path copied: ${r.path}`, action: { label: "Open", href: r.url } });
          })
          .catch(fail),
    },
    {
      id: "github",
      label: "GitHub",
      icon: <GithubIcon size={14} />,
      disabled: !p.links.github,
      hint: p.links.github ? undefined : "No GitHub remote",
      run: () => {
        ui.closeMenu();
        window.open(p.links.github, "_blank", "noopener");
      },
    },
    {
      id: "database",
      label: "Database",
      icon: <Database size={15} />,
      group: true,
      disabled: !hasCompose,
      run: () => ui.openDialog("database", p),
    },
    {
      id: "tests",
      label: "Tests",
      icon: <FlaskConical size={15} />,
      disabled: !p.tests.some((t) => t.kind !== "coverage"),
      hint: p.tests.length ? undefined : "No test scripts found",
      run: () => ui.openDialog("tests", p),
    },
    {
      id: "coverage",
      label: "Coverage",
      icon: <ShieldCheck size={15} />,
      disabled: !p.tests.some((t) => t.kind === "coverage"),
      run: () => ui.openDialog("coverage", p),
    },
    { id: "run", label: "Run", icon: <Play size={15} />, group: true, disabled: !hasCompose, run: () => job("run") },
    { id: "restart", label: "Restart", icon: <RotateCw size={15} />, disabled: !hasCompose || !running, run: () => job("restart") },
    { id: "stop", label: "Stop", icon: <Square size={14} />, disabled: !hasCompose || !running, run: () => job("stop") },
    { id: "rename", label: "Rename", icon: <Pencil size={15} />, group: true, run: () => ui.openDialog("rename", p) },
    {
      id: "remove",
      label: "Remove",
      icon: <Trash2 size={15} />,
      danger: true,
      run: () => ui.openDialog("remove", p),
    },
  ];
  return items.map((a) => ({ ...a, run: a.disabled ? () => undefined : a.run }));
}
