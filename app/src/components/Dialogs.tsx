import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Database, ExternalLink, FlaskConical, LoaderCircle, Play, ShieldCheck, TriangleAlert } from "lucide-react";
import { api, ApiError } from "../api/client";
import { keys } from "../api/hooks";
import { ToolIcon } from "../lib/icons";
import { useJobOutput, useStatus } from "../lib/live";
import { useUI } from "../lib/ui";
import type { Project, ToolCategory } from "../types";
import { Button, buttonClass, Dialog, Field, inputCls } from "./ui";

export function GlobalDialogs() {
  const { dialog, closeDialog } = useUI();
  if (!dialog) return null;
  const p = dialog.project;
  switch (dialog.kind) {
    case "tools":
      return <ToolsDialog project={p} onClose={closeDialog} />;
    case "tests":
    case "coverage":
      return <TestsDialog project={p} kind={dialog.kind} onClose={closeDialog} />;
    case "rename":
      return <RenameDialog project={p} onClose={closeDialog} />;
    case "remove":
      return <RemoveDialog project={p} onClose={closeDialog} />;
    case "database":
      return <DatabaseDialog project={p} onClose={closeDialog} />;
  }
}

const CATEGORY_LABEL: Record<ToolCategory, string> = {
  framework: "Frameworks",
  runtime: "Runtimes",
  language: "Languages",
  database: "Data",
  infra: "Infrastructure",
  styling: "Styling",
  library: "Libraries",
  build: "Build",
  testing: "Testing",
  ci: "CI",
};
const ORDER: ToolCategory[] = ["framework", "runtime", "language", "database", "infra", "styling", "library", "testing", "build", "ci"];

export function ToolList({ project }: { project: Project }) {
  return (
    <div className="space-y-4">
      {ORDER.map((cat) => {
        const tools = project.tools.filter((t) => t.category === cat);
        if (!tools.length) return null;
        return (
          <div key={cat}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-nord4/50 mb-1.5">{CATEGORY_LABEL[cat]}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {tools.map((t) => (
                <div key={t.id} title={t.source} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 bg-nord0/40 border border-white/[0.04]">
                  <ToolIcon id={t.id} category={t.category} size={15} />
                  <span className="text-[13px] text-nord5 truncate">{t.name}</span>
                  <span className="ml-auto text-[11px] text-nord4/60 tabular-nums">{t.version ?? "–"}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ToolsDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} title={`${project.manifest.name} · toolset`}>
      <ToolList project={project} />
    </Dialog>
  );
}

function TestsDialog({ project, kind, onClose }: { project: Project; kind: "tests" | "coverage"; onClose: () => void }) {
  const ui = useUI();
  const list = project.tests.filter((t) => (kind === "coverage" ? t.kind === "coverage" : t.kind !== "coverage"));
  const [selected, setSelected] = useState<string[]>(list.map((t) => t.id));
  const [busy, setBusy] = useState(false);

  const run = async (ids: string[]) => {
    setBusy(true);
    try {
      const r = await api<{ jobId: string }>(`/projects/${project.slug}/actions/${kind}`, { method: "POST", json: { ids } });
      ui.showJob(r.jobId);
      onClose();
    } catch (e) {
      ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {kind === "coverage" ? <ShieldCheck size={15} /> : <FlaskConical size={15} />}
          {kind === "coverage" ? "Coverage" : "Tests"} · {project.manifest.name}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!selected.length || busy} onClick={() => run(selected)}>
            {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Play size={14} />}
            Run {selected.length === list.length ? "all" : selected.length}
          </Button>
        </>
      }
    >
      <p className="text-xs text-nord4/60 mb-3">
        Commands run inside the matching compose service (<code>docker compose exec</code> when running, <code>run --rm</code> otherwise).
      </p>
      <ul className="space-y-1">
        {list.map((t) => (
          <li key={t.id}>
            <label className="flex items-center gap-3 rounded-lg px-3 py-2 bg-nord0/40 border border-white/[0.04] hover:border-nord8/30 cursor-pointer">
              <input
                type="checkbox"
                className="accent-nord8"
                checked={selected.includes(t.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))}
              />
              <span className="text-[13px] text-nord5">{t.label}</span>
              <span className="text-[11px] px-1.5 rounded bg-nord2/60 text-nord4/80">{t.runner}</span>
              {t.kind === "e2e" && <span className="text-[11px] px-1.5 rounded bg-nord15/20 text-nord15">e2e</span>}
              <span className="ml-auto text-[11px] text-nord4/50">{t.service ? `svc: ${t.service}` : "host"}</span>
            </label>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function RenameDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const ui = useUI();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(project.manifest.name);
  const [folder, setFolder] = useState(project.slug);
  const [busy, setBusy] = useState(false);
  const folderChanged = folder !== project.slug;

  const save = async () => {
    setBusy(true);
    try {
      const r = await api<{ slug: string }>(`/projects/${project.slug}/actions/rename`, {
        method: "POST",
        json: { name, folder: folderChanged ? folder : undefined },
      });
      await qc.invalidateQueries({ queryKey: keys.projects });
      await qc.invalidateQueries({ queryKey: keys.state });
      if (r.slug !== project.slug && location.pathname.startsWith(`/projects/${project.slug}`)) nav(`/projects/${r.slug}`, { replace: true });
      qc.invalidateQueries({ queryKey: keys.project(r.slug) });
      ui.toast({ kind: "success", text: "Renamed" });
      onClose();
    } catch (e) {
      ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Rename project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Display name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field
          label="Folder"
          hint={
            folderChanged ? (
              <span className="flex gap-1.5 text-nord13">
                <TriangleAlert size={13} className="shrink-0 mt-px" />
                Project must be stopped. COMPOSE_PROJECT_NAME={project.slug} is pinned in .env so existing volumes keep working.
              </span>
            ) : (
              "Only the display name changes unless you edit this."
            )
          }
        >
          <input className={inputCls} value={folder} onChange={(e) => setFolder(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "-"))} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function RemoveDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const ui = useUI();
  const nav = useNavigate();
  const [stop, setStop] = useState(true);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const r = await api<{ jobId: string }>(`/projects/${project.slug}/actions/remove`, { method: "POST", json: { stop } });
      ui.showJob(r.jobId);
      onClose();
      nav("/");
    } catch (e) {
      ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Remove project"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy || confirm !== project.slug} onClick={remove}>
            Move to trash
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        <p className="text-nord4/80">
          <b className="text-nord6">{project.manifest.name}</b> will be moved to <code className="text-nord8">.aurora/trash/</code> inside your projects folder.
          Nothing is deleted and Docker volumes (databases) are kept.
        </p>
        {project.compose.file && (
          <label className="flex items-center gap-2 text-nord5">
            <input type="checkbox" className="accent-nord8" checked={stop} onChange={(e) => setStop(e.target.checked)} />
            Stop its containers first (<code>docker compose stop</code>)
          </label>
        )}
        <Field label={`Type "${project.slug}" to confirm`}>
          <input className={inputCls} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </div>
    </Dialog>
  );
}

function DatabaseDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const ui = useUI();
  const status = useStatus(project.slug);
  const [state, setState] = useState<{ step: "idle" | "busy" | "starting" | "error"; url?: string; jobId?: string; canConfigure?: boolean; error?: string }>({
    step: "idle",
  });
  const job = useJobOutput(state.jobId);
  const hasPgadmin = project.compose.services.some((s) => /pgadmin/.test(s.image ?? ""));
  const hasPostgres = project.compose.services.some((s) => /postgres|postgis/.test(s.image ?? ""));
  const running = status?.containers.some((c) => /pgadmin/.test(c.image) && c.state === "running");

  const call = async (action: "database" | "database-configure") => {
    setState({ step: "busy" });
    try {
      const r = await api<{ configured: boolean; url?: string; jobId?: string; canConfigure?: boolean }>(`/projects/${project.slug}/actions/${action}`, {
        method: "POST",
        json: {},
      });
      if (!r.configured) setState({ step: "idle", canConfigure: r.canConfigure });
      else setState({ step: "starting", url: r.url, jobId: r.jobId });
    } catch (e) {
      setState({ step: "error", error: e instanceof ApiError ? e.message : String(e) });
    }
  };

  const ready = state.step === "starting" && job.status === "success";

  return (
    <Dialog open onClose={onClose} title={<span className="flex items-center gap-2"><Database size={15} />Database · {project.manifest.name}</span>}>
      <div className="space-y-4 text-[13px]">
        {hasPgadmin ? (
          <>
            <p className="text-nord4/80">
              pgAdmin runs under the <code className="text-nord8">debug</code> profile and only starts on demand.
              {running && <span className="text-nord14"> It is running now.</span>}
            </p>
            {state.step === "starting" && !ready && (
              <p className="flex items-center gap-2 text-nord4/70">
                <LoaderCircle size={14} className="animate-spin" /> Starting pgAdmin…
              </p>
            )}
            {job.status === "failed" && <p className="text-nord11">Failed to start pgAdmin. See the job log.</p>}
            <div className="flex flex-wrap gap-2">
              {(ready || running) && (state.url ?? project.links.pgadmin) ? (
                <a
                  href={state.url ?? project.links.pgadmin}
                  target="_blank"
                  rel="noopener"
                  className={buttonClass("primary")}
                >
                  <ExternalLink size={14} /> Open pgAdmin
                </a>
              ) : (
                <Button variant="primary" disabled={state.step === "busy" || state.step === "starting"} onClick={() => call("database")}>
                  <Play size={14} /> Start pgAdmin
                </Button>
              )}
              {state.jobId && (
                <Button variant="ghost" onClick={() => ui.showJob(state.jobId)}>
                  View log
                </Button>
              )}
            </div>
          </>
        ) : hasPostgres ? (
          <>
            <p className="text-nord4/80">
              No pgAdmin service yet. Aurora can add one to <code className="text-nord8">{project.compose.file}</code> with{" "}
              <code className="text-nord8">profiles: [debug]</code>, a localhost-only port and the Postgres server pre-registered. The original file is backed
              up to <code>.aurora/backups/</code>.
            </p>
            <Button variant="primary" disabled={state.step === "busy"} onClick={() => call("database-configure")}>
              <Database size={14} /> Configure pgAdmin
            </Button>
          </>
        ) : (
          <p className="text-nord4/70">No PostgreSQL service found in this project's compose file.</p>
        )}
        {state.error && <p className="text-nord11">{state.error}</p>}
      </div>
    </Dialog>
  );
}
