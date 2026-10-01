import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronUp, CircleCheck, CircleX, LoaderCircle, Terminal, X } from "lucide-react";
import { useJobs } from "../api/hooks";
import { ansiSegments } from "../lib/format";
import { useJobOutput } from "../lib/live";
import { useUI } from "../lib/ui";
import { cx, IconButton } from "./ui";

export function JobLog({ output, className }: { output: string; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [output]);
  return (
    <pre
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={cx("overflow-auto text-[12px] leading-5 text-nord4/90 whitespace-pre-wrap break-words font-mono", className)}
    >
      {ansiSegments(output).map((s, i) => (
        <span key={i} className={s.cls}>
          {s.text}
        </span>
      ))}
    </pre>
  );
}

export function JobStatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  if (status === "running") return <LoaderCircle size={size} className="animate-spin text-nord8" aria-label="Running" />;
  if (status === "success") return <CircleCheck size={size} className="text-nord14" aria-label="Succeeded" />;
  return <CircleX size={size} className="text-nord11" aria-label="Failed" />;
}

/** Bottom-right terminal drawer for the job the user just started (or picked). */
export function JobPanel() {
  const { jobId, showJob } = useUI();
  const [open, setOpen] = useState(true);
  const { data } = useJobs();
  const job = data?.jobs.find((j) => j.id === jobId);
  const out = useJobOutput(jobId);

  useEffect(() => setOpen(true), [jobId]);
  if (!jobId) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(42rem,calc(100vw-2rem))] glass-strong rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-11 border-b border-white/[0.06]">
        <Terminal size={14} className="text-nord8" />
        <JobStatusIcon status={out.status} />
        <span className="text-[13px] text-nord5 truncate">{job?.label ?? "Job"}</span>
        {job && (
          <Link to={`/projects/${job.slug}`} className="text-[11px] text-nord8/80 hover:text-nord8 shrink-0">
            {job.slug}
          </Link>
        )}
        <span className="ml-auto" />
        <IconButton label={open ? "Collapse" : "Expand"} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </IconButton>
        <IconButton label="Close" onClick={() => showJob(undefined)}>
          <X size={15} />
        </IconButton>
      </div>
      {open && <JobLog output={out.output || "…"} className="h-72 p-3 bg-night/60" />}
    </div>
  );
}
