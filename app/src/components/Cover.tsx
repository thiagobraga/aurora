import { useRef, useState, type ReactNode } from "react";
import { assetUrl } from "../api/client";
import { coverGradient } from "../lib/format";
import type { Project } from "../types";
import { cx } from "./ui";

export function coverSrc(p: Project): string | undefined {
  const img = p.manifest.cover.image;
  if (img === "file" && p.hasCoverFile) return assetUrl(`/projects/${p.slug}/cover`, String(p.coverVersion ?? ""));
  if (img && /^https?:\/\//.test(img)) return img;
  return undefined;
}

/**
 * Cover image with readable-text overlays. Two layers keep any image legible:
 * a uniform scrim (strength from manifest.cover.overlay) and a bottom-up
 * gradient where the text sits.
 */
export function Cover({
  project,
  className,
  children,
  reposition,
  onPosition,
  position,
  overlay,
}: {
  project: Project;
  className?: string;
  children?: ReactNode;
  /** Enable drag-to-reposition. */
  reposition?: boolean;
  onPosition?: (pos: { x: number; y: number }) => void;
  position?: { x: number; y: number };
  overlay?: number;
}) {
  const src = coverSrc(project);
  const pos = position ?? project.manifest.cover.position;
  const strength = (overlay ?? project.manifest.cover.overlay) / 100;
  const drag = useRef<{ x: number; y: number; start: { x: number; y: number } } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!reposition) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    // Dragging the image right reveals its left side, so the percentage moves the other way.
    const dx = ((e.clientX - drag.current.x) / r.width) * 100;
    const dy = ((e.clientY - drag.current.y) / r.height) * 100;
    const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
    onPosition?.({ x: clamp(drag.current.start.x - dx), y: clamp(drag.current.start.y - dy * 1.5) });
  };
  const end = () => (drag.current = null);

  return (
    <div ref={box} className={cx("relative overflow-hidden", className)}>
      <div className="absolute inset-0" style={{ background: coverGradient(project.slug) }} />
      {src && !failed && (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={end}
          onPointerCancel={end}
          className={cx("absolute inset-0 size-full object-cover select-none", reposition && "cursor-grab active:cursor-grabbing touch-none")}
          style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
        />
      )}
      <div className="absolute inset-0 bg-night pointer-events-none" style={{ opacity: src && !failed ? strength * 0.55 : 0.1 }} />
      <div className="absolute inset-0 bg-linear-to-t from-night via-night/70 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-night/60 to-transparent pointer-events-none" />
      {reposition && (
        <div className="absolute inset-0 pointer-events-none grid place-items-center">
          <span className="rounded-full bg-nord0/70 backdrop-blur px-3 py-1 text-xs text-nord6 border border-white/10">Drag to reposition</span>
        </div>
      )}
      {children}
    </div>
  );
}
