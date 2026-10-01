import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, FileArchive, FolderUp, LoaderCircle, Rocket, Upload } from "lucide-react";
import { api, ApiError, upload } from "../api/client";
import { keys, useTemplates } from "../api/hooks";
import { JobLog, JobStatusIcon } from "../components/JobPanel";
import { Button, cx, Field, inputCls, Panel } from "../components/ui";
import { ToolIcon } from "../lib/icons";
import { useJobOutput } from "../lib/live";
import { useUI } from "../lib/ui";
import type { Template } from "../types";

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 64);

export function NewProject() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-nord6 tracking-tight">New project</h1>
        <p className="text-xs text-nord4/60 mt-1">Scaffold from a template, or import a folder / zip exported from ChatGPT, Claude, v0…</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <CreateFromTemplate />
        <ImportPanel />
      </div>
    </div>
  );
}

function TemplateCard({ t, selected, onSelect }: { t: Template; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "relative text-left rounded-2xl p-4 border transition backdrop-blur",
        selected ? "border-nord8/60 bg-nord8/10 shadow-[0_0_0_1px_var(--color-nord8)]" : "border-white/[0.07] bg-nord0/30 hover:border-white/20",
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 size-5 grid place-items-center rounded-full bg-nord8 text-nord0">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      <div className="font-display text-[13px] text-nord6 pr-6">{t.name}</div>
      <p className="text-[11px] text-nord4/60 mt-1.5 leading-relaxed">{t.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {t.tools.map((id) => (
          <span key={id} title={id} className="size-6 grid place-items-center rounded-md bg-nord0/50 border border-white/[0.06]">
            <ToolIcon id={id} size={13} />
          </span>
        ))}
      </div>
      <div className="text-[10px] text-nord4/45 mt-3">services: {t.services.join(" · ")}</div>
    </button>
  );
}

function CreateFromTemplate() {
  const { data } = useTemplates();
  const ui = useUI();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [template, setTemplate] = useState<string>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [start, setStart] = useState(true);
  const [job, setJob] = useState<{ id: string; slug: string }>();
  const out = useJobOutput(job?.id);
  const tpl = template ?? data?.templates[0]?.id;
  const finalSlug = slugTouched ? slug : slugify(name);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ slug: string; jobId: string }>("/projects", {
        method: "POST",
        json: { template: tpl, name, slug: finalSlug, description, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), start },
      });
      setJob({ id: r.jobId, slug: r.slug });
      qc.invalidateQueries({ queryKey: keys.projects });
    } catch (err) {
      ui.toast({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    }
  };

  return (
    <Panel title="From template" icon={<Rocket size={13} />}>
      <form onSubmit={create} className="space-y-5">
        <div role="radiogroup" aria-label="Template" className="grid sm:grid-cols-2 gap-3">
          {data?.templates.map((t) => <TemplateCard key={t.id} t={t} selected={t.id === tpl} onSelect={() => setTemplate(t.id)} />)}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="My new app" required />
          </Field>
          <Field label="Folder" hint="Also the compose project name and local subdomain">
            <input
              className={inputCls}
              value={finalSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="my-new-app"
            />
          </Field>
        </div>
        <Field label="Description">
          <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it for?" />
        </Field>
        <Field label="Tags" hint="Comma separated">
          <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="web, personal" />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[13px] text-nord5">
            <input type="checkbox" className="accent-nord8" checked={start} onChange={(e) => setStart(e.target.checked)} />
            Build and start containers now
          </label>
          <Button type="submit" variant="primary" disabled={!name.trim() || !tpl || (!!job && out.status === "running")}>
            <Rocket size={14} /> Create project
          </Button>
        </div>
      </form>

      {job && (
        <div className="mt-5 rounded-xl overflow-hidden border border-white/[0.07]">
          <div className="flex items-center gap-2 px-3 h-10 bg-nord0/60 text-[13px]">
            <JobStatusIcon status={out.status} />
            <span className="text-nord5">{out.status === "running" ? "Creating…" : out.status === "success" ? "Ready" : "Failed"}</span>
            <span className="flex-1" />
            {out.status !== "running" && (
              <Button size="sm" variant="primary" onClick={() => nav(`/projects/${job.slug}`)}>
                Open project
              </Button>
            )}
          </div>
          <JobLog output={out.output} className="h-64 p-3 bg-night/70" />
        </div>
      )}
    </Panel>
  );
}

// ---- import ----------------------------------------------------------------

type Picked = { kind: "zip"; file: File } | { kind: "folder"; files: { file: File; path: string }[]; root: string };

const SKIP_DIRS = new Set(["node_modules", "__MACOSX", ".venv", "venv", "__pycache__", "dist", ".next"]);

async function readEntry(entry: FileSystemEntry, out: { file: File; path: string }[]) {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ file, path: entry.fullPath.replace(/^\//, "") });
  } else if (entry.isDirectory) {
    if (SKIP_DIRS.has(entry.name)) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries returns batches of ~100; keep reading until empty.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await readEntry(e, out);
    }
  }
}

function ImportPanel() {
  const ui = useUI();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Picked>();
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("Claude");
  const [progress, setProgress] = useState<number>();
  const zipInput = useRef<HTMLInputElement>(null);
  const dirInput = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    if (!picked) return undefined;
    if (picked.kind === "zip") return { label: picked.file.name, size: picked.file.size, count: 1 };
    return { label: picked.root || "folder", size: picked.files.reduce((n, f) => n + f.file.size, 0), count: picked.files.length };
  }, [picked]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const items = [...e.dataTransfer.items];
    const entries = items.map((i) => i.webkitGetAsEntry?.()).filter((x): x is FileSystemEntry => !!x);
    if (entries.length === 1 && entries[0].isFile && /\.zip$/i.test(entries[0].name)) {
      setPicked({ kind: "zip", file: e.dataTransfer.files[0] });
      setName("");
      return;
    }
    const files: { file: File; path: string }[] = [];
    for (const en of entries) await readEntry(en, files);
    if (!files.length) return ui.toast({ kind: "error", text: "Nothing to import" });
    const root = entries.length === 1 && entries[0].isDirectory ? entries[0].name : "";
    setPicked({ kind: "folder", files, root });
    setName("");
  };

  const send = async () => {
    if (!picked) return;
    const form = new FormData();
    if (name) form.append("name", name);
    form.append("source", source);
    if (picked.kind === "zip") form.append("files", picked.file, picked.file.name);
    else
      for (const f of picked.files) {
        form.append("paths", f.path);
        form.append("files", f.file, f.file.name);
      }
    setProgress(0);
    try {
      const r = await upload<{ slug: string }>("/import", form, setProgress);
      qc.invalidateQueries({ queryKey: keys.projects });
      ui.toast({ kind: "success", text: `Imported as ${r.slug}` });
      nav(`/projects/${r.slug}`);
    } catch (err) {
      ui.toast({ kind: "error", text: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setProgress(undefined);
    }
  };

  return (
    <Panel title="Import" icon={<Upload size={13} />}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cx(
          "rounded-2xl border-2 border-dashed p-8 grid place-items-center text-center transition",
          over ? "border-nord8 bg-nord8/10" : "border-white/[0.12] bg-nord0/30",
        )}
      >
        <div className="size-14 rounded-2xl grid place-items-center bg-linear-to-br from-nord10/40 to-nord15/40 border border-white/10 mb-4">
          <FolderUp size={24} className="text-nord6" />
        </div>
        <p className="font-display text-[13px] text-nord6">Drop a folder or a .zip here</p>
        <p className="text-[11px] text-nord4/55 mt-1.5 max-w-xs">
          Single top-level folders are unwrapped; node_modules and __MACOSX are skipped. The project lands in your base folder with a git repo.
        </p>
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => zipInput.current?.click()}>
            <FileArchive size={13} /> Choose zip
          </Button>
          <Button size="sm" onClick={() => dirInput.current?.click()}>
            <FolderUp size={13} /> Choose folder
          </Button>
        </div>
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => e.target.files?.[0] && setPicked({ kind: "zip", file: e.target.files[0] })}
        />
        <input
          ref={dirInput}
          type="file"
          hidden
          // @ts-expect-error non-standard but supported by Chromium and Firefox
          webkitdirectory=""
          onChange={(e) => {
            const list = [...(e.target.files ?? [])].filter((f) => !f.webkitRelativePath.split("/").some((seg) => SKIP_DIRS.has(seg)));
            if (list.length)
              setPicked({ kind: "folder", files: list.map((f) => ({ file: f, path: f.webkitRelativePath })), root: list[0].webkitRelativePath.split("/")[0] });
          }}
        />
      </div>

      {picked && summary && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-nord0/40 border border-white/[0.06]">
            {picked.kind === "zip" ? <FileArchive size={18} className="text-nord8" /> : <FolderUp size={18} className="text-nord8" />}
            <div className="min-w-0">
              <div className="text-[13px] text-nord6 truncate">{summary.label}</div>
              <div className="text-[11px] text-nord4/55">
                {summary.count} file{summary.count === 1 ? "" : "s"} · {(summary.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (optional)">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="from folder / zip" />
            </Field>
            <Field label="Made with">
              <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
                {["Claude", "ChatGPT", "v0", "Lovable", "Bolt", "Gemini", "Other"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          {progress !== undefined && (
            <div className="h-1.5 rounded-full bg-nord0/70 overflow-hidden" role="progressbar" aria-valuenow={progress}>
              <div className="h-full bg-nord8 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPicked(undefined)}>
              Clear
            </Button>
            <Button variant="primary" disabled={progress !== undefined} onClick={send}>
              {progress !== undefined ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
              Import
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
