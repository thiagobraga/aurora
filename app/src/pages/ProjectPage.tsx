import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Boxes, Check, Container, ExternalLink, GitBranch, GitCommitHorizontal, Globe, ImagePlus, Link2, ListChecks,
  LoaderCircle, Monitor, Move, Pencil, Play, Sparkles, Star, Terminal, Trash2, Wrench,
} from "lucide-react";
import { api, ApiError, upload } from "../api/client";
import { keys, useAppState, useCommits, useJobs, usePatchProject, useProject, useToggleFavorite } from "../api/hooks";
import { Cover } from "../components/Cover";
import { ToolList } from "../components/Dialogs";
import { JobStatusIcon } from "../components/JobPanel";
import { ProjectIcon } from "../components/ProjectCard";
import { StatusPills } from "../components/StatusPill";
import { BoolIcon, Button, buttonClass, cx, Empty, Field, inputCls, Panel } from "../components/ui";
import { useProjectActions } from "../lib/actions";
import { ago, bytes } from "../lib/format";
import { GithubIcon } from "../lib/icons";
import { useStatus } from "../lib/live";
import { useUI } from "../lib/ui";
import { FEATURES, type Manifest, type Project, type ProjectStatus } from "../types";

export function ProjectPage() {
  const { slug = "" } = useParams();
  const { data, isLoading, error } = useProject(slug);
  const status = useStatus(slug, data?.status ? { [slug]: data.status } : undefined);

  if (isLoading) return <div className="h-80 rounded-2xl glass animate-pulse" />;
  if (error || !data)
    return (
      <Empty title="Project not found">
        <Link to="/" className="text-nord8">Back to dashboard</Link>
      </Empty>
    );
  return <ProjectView project={data.project} status={status} />;
}

function ProjectView({ project: p, status }: { project: Project; status?: ProjectStatus }) {
  const ui = useUI();
  const actions = useProjectActions(p, status);
  const { data: st } = useAppState();
  const toggleFav = useToggleFavorite();
  const fav = st?.state.favorites.includes(p.slug) ?? false;
  const m = p.manifest;

  return (
    <div className="space-y-5" onContextMenu={(e) => (e.target as HTMLElement).closest("[data-hero]") && ui.openMenu(e, p)}>
      <Hero project={p} status={status} fav={fav} onFav={() => toggleFav(p.slug)} />

      <div role="toolbar" aria-label="Project actions" className="glass rounded-2xl p-1.5 flex flex-wrap items-center gap-1">
        {actions.map((a) => (
          <span key={a.id} className="contents">
            {a.group && <span className="w-px h-6 bg-white/[0.08] mx-1" aria-hidden />}
            <button
              type="button"
              disabled={a.disabled}
              title={a.hint ?? a.label}
              onClick={a.run}
              className={cx(
                "h-9 px-3 inline-flex items-center gap-2 rounded-xl text-[13px] transition disabled:opacity-35 disabled:cursor-not-allowed",
                a.danger ? "text-nord11/90 hover:bg-nord11/15" : "text-nord5 hover:bg-white/[0.07] hover:text-nord6",
              )}
            >
              {a.icon}
              <span className="hidden sm:inline">{a.label}</span>
            </button>
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2 min-w-0">
          <ContainersPanel project={p} status={status} />
          <Panel title="Toolset" icon={<Wrench size={13} />} actions={<span className="text-[11px] text-nord4/50">{p.tools.length} detected</span>}>
            {p.tools.length ? <ToolList project={p} /> : <p className="text-xs text-nord4/50">Nothing detected yet.</p>}
          </Panel>
          <FeaturesPanel project={p} />
          <TestsPanel project={p} />
          <JobsPanel slug={p.slug} />
        </div>
        <div className="space-y-5 min-w-0">
          <DetailsPanel key={p.updatedAt + JSON.stringify(m)} project={p} />
          <CommitsPanel project={p} />
        </div>
      </div>
    </div>
  );
}

function Hero({ project: p, status, fav, onFav }: { project: Project; status?: ProjectStatus; fav: boolean; onFav: () => void }) {
  const ui = useUI();
  const qc = useQueryClient();
  const patch = usePatchProject(p.slug);
  const m = p.manifest;
  const [repo, setRepo] = useState(false);
  const [pos, setPos] = useState(m.cover.position);
  const [overlay, setOverlay] = useState(m.cover.overlay);
  const [menu, setMenu] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPos(m.cover.position);
    setOverlay(m.cover.overlay);
  }, [m.cover.position, m.cover.overlay]);

  const uploadCover = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    const form = new FormData();
    form.append("file", f);
    try {
      const r = await upload<{ project: Project }>(`/projects/${p.slug}/cover`, form);
      qc.setQueryData(keys.project(p.slug), (old: object | undefined) => ({ ...old, project: r.project }));
      qc.invalidateQueries({ queryKey: keys.projects });
      setRepo(true);
    } catch (e) {
      ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) });
    } finally {
      setBusy(false);
      setMenu(false);
    }
  };

  const removeCover = async () => {
    const r = await api<{ project: Project }>(`/projects/${p.slug}/cover`, { method: "DELETE" });
    qc.setQueryData(keys.project(p.slug), (old: object | undefined) => ({ ...old, project: r.project }));
    qc.invalidateQueries({ queryKey: keys.projects });
    setMenu(false);
  };

  const fromUrl = () => {
    const url = window.prompt("Image URL (https://…)");
    if (url && /^https?:\/\//.test(url)) patch.mutate({ cover: { ...m.cover, image: url } });
    setMenu(false);
  };

  return (
    <div
      data-hero
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((i) => i.type.startsWith("image/"))) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void uploadCover([...e.dataTransfer.files].find((f) => f.type.startsWith("image/")));
      }}
      className={cx("relative rounded-3xl overflow-hidden border border-white/[0.07] shadow-[0_30px_70px_-30px_rgb(0_0_0/0.8)]", dragOver && "ring-2 ring-nord8")}
    >
      <Cover project={p} className="h-72 sm:h-80" reposition={repo} position={pos} overlay={overlay} onPosition={setPos}>
        <div className={cx("absolute inset-0 flex flex-col justify-between p-5 sm:p-7", repo && "pointer-events-none")}>
          <div className="flex items-start justify-between gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-nord0/50 backdrop-blur-md border border-white/[0.08] text-xs text-nord5 hover:text-nord6">
              <ArrowLeft size={14} /> Projects
            </Link>
            <div className="flex items-center gap-1.5">
              <StatusPills status={status} source={m.statusSource} />
              <button
                type="button"
                aria-label={fav ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={fav}
                onClick={onFav}
                className={cx("size-8 grid place-items-center rounded-lg backdrop-blur-md border border-white/[0.08]", fav ? "bg-nord13/20 text-nord13" : "bg-nord0/50 text-nord4/80 hover:text-nord13")}
              >
                <Star size={15} fill={fav ? "currentColor" : "none"} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Cover options"
                  aria-expanded={menu}
                  onClick={() => setMenu((v) => !v)}
                  className="size-8 grid place-items-center rounded-lg bg-nord0/50 backdrop-blur-md border border-white/[0.08] text-nord4/80 hover:text-nord6"
                >
                  {busy ? <LoaderCircle size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                </button>
                {menu && (
                  <div className="absolute right-0 top-10 z-20 w-64 glass-strong rounded-xl p-1.5 text-[13px]">
                    <button type="button" className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg hover:bg-white/[0.07]" onClick={() => file.current?.click()}>
                      <ImagePlus size={14} /> Upload image…
                    </button>
                    <button type="button" className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg hover:bg-white/[0.07]" onClick={fromUrl}>
                      <Link2 size={14} /> Use image URL…
                    </button>
                    <button
                      type="button"
                      disabled={!m.cover.image}
                      className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg hover:bg-white/[0.07] disabled:opacity-40"
                      onClick={() => {
                        setRepo(true);
                        setMenu(false);
                      }}
                    >
                      <Move size={14} /> Reposition
                    </button>
                    <label className="block px-2.5 py-2">
                      <span className="flex justify-between text-[11px] text-nord4/60 mb-1.5">
                        Darken <span className="tabular-nums">{overlay}%</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={overlay}
                        onChange={(e) => setOverlay(Number(e.target.value))}
                        onPointerUp={() => patch.mutate({ cover: { ...m.cover, overlay } })}
                        onKeyUp={() => patch.mutate({ cover: { ...m.cover, overlay } })}
                        className="w-full accent-nord8"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!m.cover.image}
                      className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-nord11 hover:bg-nord11/15 disabled:opacity-40"
                      onClick={removeCover}
                    >
                      <Trash2 size={14} /> Remove cover
                    </button>
                  </div>
                )}
                <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" hidden onChange={(e) => void uploadCover(e.target.files?.[0])} />
              </div>
            </div>
          </div>

          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-3">
              <ProjectIcon project={p} size={40} />
              <h1 className="font-display text-2xl sm:text-3xl text-nord6 tracking-tight text-shadow">{m.name}</h1>
            </div>
            {m.description && <p className="text-sm text-nord5/90 text-shadow leading-relaxed">{m.description}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {m.tags.map((t) => (
                <span key={t} className="text-[11px] uppercase tracking-wider text-nord8 text-shadow">#{t}</span>
              ))}
              <span className="flex-1" />
              {p.links.local && (
                <a href={p.links.local} target="_blank" rel="noopener" className={buttonClass("glass", "sm")}>
                  <Monitor size={13} /> Local
                </a>
              )}
              {p.links.prod && (
                <a href={p.links.prod} target="_blank" rel="noopener" className={buttonClass("glass", "sm")}>
                  <Globe size={13} /> Production
                </a>
              )}
              {p.links.github && (
                <a href={p.links.github} target="_blank" rel="noopener" className={buttonClass("glass", "sm")}>
                  <GithubIcon size={13} /> GitHub
                </a>
              )}
            </div>
          </div>
        </div>
      </Cover>
      {repo && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          <Button
            size="sm"
            onClick={() => {
              setPos(m.cover.position);
              setRepo(false);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              patch.mutate({ cover: { ...m.cover, position: pos } });
              setRepo(false);
            }}
          >
            <Check size={14} /> Save position
          </Button>
        </div>
      )}
    </div>
  );
}

function ContainersPanel({ project: p, status }: { project: Project; status?: ProjectStatus }) {
  if (!p.compose.file) return null;
  const containers = status?.containers ?? [];
  const known = new Set(containers.map((c) => c.service));
  const missing = p.compose.services.filter((s) => !known.has(s.name));
  return (
    <Panel title="Containers" icon={<Container size={13} />} actions={<span className="text-[11px] text-nord4/50">{p.compose.file}</span>}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[12px] min-w-[520px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.14em] text-nord4/50">
              <th className="text-left font-normal px-1 py-1.5">Service</th>
              <th className="text-left font-normal px-1">State</th>
              <th className="text-left font-normal px-1">Image</th>
              <th className="text-right font-normal px-1">CPU</th>
              <th className="text-right font-normal px-1">Memory</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => (
              <tr key={c.id} className="border-t border-white/[0.04]" title={c.status}>
                <td className="px-1 py-2 text-nord6">{c.service}</td>
                <td className="px-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cx("size-2 rounded-full", c.state === "running" ? (c.health === "unhealthy" ? "bg-nord13" : "bg-nord14") : "bg-nord3")} />
                    <span className={c.state === "running" ? "text-nord5" : "text-nord4/60"}>{c.state}</span>
                    {c.health && <span className="text-nord4/50">· {c.health}</span>}
                  </span>
                </td>
                <td className="px-1 text-nord4/60 truncate max-w-48">{c.image}</td>
                <td className="px-1 text-right tabular-nums">{c.cpu !== undefined ? `${c.cpu.toFixed(1)}%` : "–"}</td>
                <td className="px-1 text-right tabular-nums">{c.memBytes !== undefined ? bytes(c.memBytes) : "–"}</td>
              </tr>
            ))}
            {missing.map((s) => (
              <tr key={s.name} className="border-t border-white/[0.04] text-nord4/50">
                <td className="px-1 py-2">{s.name}</td>
                <td className="px-1">{s.profiles.length ? `profile: ${s.profiles.join(", ")}` : "not created"}</td>
                <td className="px-1 truncate max-w-48">{s.image ?? (s.build ? `build ${s.build}` : "")}</td>
                <td className="px-1 text-right">–</td>
                <td className="px-1 text-right">–</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function FeaturesPanel({ project: p }: { project: Project }) {
  const patch = usePatchProject(p.slug);
  return (
    <Panel title="Features" icon={<Sparkles size={13} />} actions={<span className="text-[11px] text-nord4/50">click to override</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
        {FEATURES.map((f) => {
          const v = p.features[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={(e) => {
                const next = { ...p.manifest.features };
                if (e.altKey) delete next[f.key];
                else next[f.key] = !v.value;
                patch.mutate({ features: next });
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-nord0/40 border border-white/[0.04] hover:border-nord8/30 text-left"
            >
              <BoolIcon value={v.value} manual={v.source === "manual"} />
              <span className={cx("text-[13px]", v.value ? "text-nord5" : "text-nord4/55")}>{f.label}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function TestsPanel({ project: p }: { project: Project }) {
  const ui = useUI();
  const run = (kind: "tests" | "coverage", ids: string[]) =>
    api<{ jobId: string }>(`/projects/${p.slug}/actions/${kind}`, { method: "POST", json: { ids } })
      .then((r) => ui.showJob(r.jobId))
      .catch((e) => ui.toast({ kind: "error", text: e instanceof ApiError ? e.message : String(e) }));

  return (
    <Panel
      title="Tests & coverage"
      icon={<ListChecks size={13} />}
      actions={
        p.tests.some((t) => t.kind !== "coverage") && (
          <Button size="sm" variant="ghost" onClick={() => run("tests", p.tests.filter((t) => t.kind !== "coverage").map((t) => t.id))}>
            <Play size={13} /> Run all
          </Button>
        )
      }
    >
      {!p.tests.length ? (
        <p className="text-xs text-nord4/50">No test scripts found (looked for npm "test*", "coverage" scripts and pytest).</p>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-1">
            {p.tests.map((t) => (
              <li key={t.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 bg-nord0/40 border border-white/[0.04]">
                <span className="text-[13px] text-nord5">{t.label}</span>
                <span className="text-[11px] px-1.5 rounded bg-nord2/60 text-nord4/80">{t.runner}</span>
                {t.kind !== "unit" && <span className="text-[11px] px-1.5 rounded bg-nord15/20 text-nord15">{t.kind}</span>}
                <span className="ml-auto text-[11px] text-nord4/40 hidden sm:inline">{t.service ? `svc ${t.service}` : "host"}</span>
                <button
                  type="button"
                  aria-label={`Run ${t.label}`}
                  onClick={() => run(t.kind === "coverage" ? "coverage" : "tests", [t.id])}
                  className="size-7 grid place-items-center rounded-md text-nord8 hover:bg-nord8/15"
                >
                  <Play size={13} />
                </button>
              </li>
            ))}
          </ul>
          {p.coverage.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2">
              {p.coverage.map((c) => (
                <div key={c.file} className="rounded-xl p-3 bg-nord0/40 border border-white/[0.04]">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-nord4/60 truncate">{c.file}</span>
                    <span className="text-[11px] text-nord4/40">{ago(c.updatedAt)}</span>
                  </div>
                  {(["lines", "statements", "branches", "functions"] as const).map((k) =>
                    c[k] === undefined ? null : (
                      <div key={k} className="mt-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-nord4/70">{k}</span>
                          <span className="tabular-nums text-nord5">{c[k]}%</span>
                        </div>
                        <div className="h-1.5 mt-1 rounded-full bg-nord0/80 overflow-hidden">
                          <div className={cx("h-full rounded-full", c[k]! >= 80 ? "bg-nord14" : c[k]! >= 50 ? "bg-nord13" : "bg-nord11")} style={{ width: `${c[k]}%` }} />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function JobsPanel({ slug }: { slug: string }) {
  const { data } = useJobs(slug);
  const ui = useUI();
  const jobs = data?.jobs ?? [];
  if (!jobs.length) return null;
  return (
    <Panel title="Recent jobs" icon={<Terminal size={13} />}>
      <ul className="divide-y divide-white/[0.04]">
        {jobs.slice(0, 8).map((j) => (
          <li key={j.id}>
            <button type="button" onClick={() => ui.showJob(j.id)} className="w-full flex items-center gap-2.5 py-2 text-left hover:text-nord6">
              <JobStatusIcon status={j.status} />
              <span className="text-[13px] text-nord5 truncate">{j.label}</span>
              <span className="ml-auto text-[11px] text-nord4/50 shrink-0">{ago(j.startedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function DetailsPanel({ project: p }: { project: Project }) {
  const patch = usePatchProject(p.slug);
  const ui = useUI();
  const m = p.manifest;
  const [form, setForm] = useState({
    name: m.name,
    description: m.description,
    tags: m.tags.join(", "),
    statusSource: m.statusSource,
    local: m.urls.local ?? "",
    prod: m.urls.prod ?? "",
    healthPath: m.urls.healthPath ?? "",
    github: m.urls.github ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Partial<Manifest> = {
      name: form.name,
      description: form.description,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      statusSource: form.statusSource,
      urls: { ...m.urls, local: form.local, prod: form.prod, healthPath: form.healthPath || undefined, github: form.github },
    };
    patch.mutate(body, {
      onSuccess: () => ui.toast({ kind: "success", text: "Saved to .aurora/project.json" }),
      onError: (err) => ui.toast({ kind: "error", text: err.message }),
    });
  };

  return (
    <Panel title="Details" icon={<Pencil size={13} />}>
      <form onSubmit={save} className="space-y-3">
        <Field label="Name">
          <input className={inputCls} value={form.name} onChange={set("name")} />
        </Field>
        <Field label="Description">
          <textarea className={`${inputCls} h-20 py-2 resize-none`} value={form.description} onChange={set("description")} />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <input className={inputCls} value={form.tags} onChange={set("tags")} />
        </Field>
        <Field label="Status from">
          <select className={inputCls} value={form.statusSource} onChange={set("statusSource")}>
            <option value="local">Local (Docker)</option>
            <option value="prod">Production (HTTP check)</option>
            <option value="both">Both</option>
          </select>
        </Field>
        <Field label="Local URL" hint={!form.local && p.links.local ? `Detected: ${p.links.local}` : undefined}>
          <input className={inputCls} value={form.local} onChange={set("local")} placeholder="https://app.local" />
        </Field>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Field label="Production URL">
            <input className={inputCls} value={form.prod} onChange={set("prod")} placeholder="https://app.example.com" />
          </Field>
          <Field label="Health path">
            <input className={inputCls} value={form.healthPath} onChange={set("healthPath")} placeholder="/" />
          </Field>
        </div>
        <Field label="GitHub URL" hint={!form.github && p.links.github ? `From git remote: ${p.links.github}` : undefined}>
          <input className={inputCls} value={form.github} onChange={set("github")} placeholder="https://github.com/you/repo" />
        </Field>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-nord4/40 truncate" title={p.path}>{p.path}</span>
          <Button type="submit" variant="primary" size="sm" disabled={patch.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function CommitsPanel({ project: p }: { project: Project }) {
  const { data, isLoading } = useCommits(p.slug);
  return (
    <Panel
      title="Latest commits"
      icon={<GitCommitHorizontal size={13} />}
      actions={
        <span className="flex items-center gap-2 text-[11px] text-nord4/50">
          {p.git.branch && (
            <span className="inline-flex items-center gap-1">
              <GitBranch size={11} /> {p.git.branch}
              {p.git.dirty && <span className="text-nord13" title="Uncommitted changes">*</span>}
            </span>
          )}
          {data && <span>{data.source === "github" ? "GitHub" : "local"}</span>}
        </span>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-10 rounded-lg bg-nord0/40 animate-pulse" />
          ))}
        </div>
      ) : !data?.commits.length ? (
        <p className="text-xs text-nord4/50">{p.git.branch ? "No commits yet." : "Not a git repository."}</p>
      ) : (
        <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
          {data.commits.slice(0, 10).map((c) => (
            <li key={c.sha} className="relative flex gap-3">
              {c.avatar ? (
                <img src={c.avatar} alt="" className="relative size-6 rounded-full ring-2 ring-nord1 shrink-0" />
              ) : (
                <span className="relative size-6 rounded-full bg-nord2 ring-2 ring-nord1 grid place-items-center shrink-0">
                  <Boxes size={11} className="text-nord4/60" />
                </span>
              )}
              <div className="min-w-0">
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener" className="text-[13px] text-nord5 hover:text-nord8 line-clamp-2">
                    {c.message}
                  </a>
                ) : (
                  <p className="text-[13px] text-nord5 line-clamp-2">{c.message}</p>
                )}
                <p className="text-[11px] text-nord4/50 mt-0.5">
                  <span className="text-nord8/70">{c.sha.slice(0, 7)}</span> · {c.author} · {ago(c.date)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {data?.repo && (
        <a href={`https://github.com/${data.repo}/commits`} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-nord8/80 hover:text-nord8">
          All commits <ExternalLink size={11} />
        </a>
      )}
    </Panel>
  );
}
