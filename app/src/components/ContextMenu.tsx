import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useProjectActions } from "../lib/actions";
import { useStatus } from "../lib/live";
import { useUI } from "../lib/ui";
import type { Project } from "../types";
import { cx } from "./ui";

export function ContextMenu() {
  const { menu } = useUI();
  if (!menu) return null;
  return <Menu key={`${menu.project.slug}-${menu.x}-${menu.y}`} x={menu.x} y={menu.y} project={menu.project} />;
}

function Menu({ x, y, project }: { x: number; y: number; project: Project }) {
  const ui = useUI();
  const items = useProjectActions(project, useStatus(project.slug));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [active, setActive] = useState(-1);

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ left: Math.min(x, window.innerWidth - r.width - 8), top: Math.min(y, window.innerHeight - r.height - 8) });
    ref.current?.focus();
  }, [x, y]);

  useEffect(() => {
    const close = (e: Event) => {
      if (e.type === "mousedown" && ref.current?.contains(e.target as Node)) return;
      ui.closeMenu();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [ui]);

  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") ui.closeMenu();
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const cur = enabled.indexOf(active);
      const next = e.key === "ArrowDown" ? enabled[(cur + 1) % enabled.length] : enabled[(cur - 1 + enabled.length) % enabled.length];
      setActive(next);
    }
    if (e.key === "Enter" && active >= 0) items[active].run();
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label={`${project.manifest.name} actions`}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-52 glass-strong rounded-xl p-1.5 outline-none"
    >
      <div className="px-2.5 pt-1 pb-2 text-[11px] text-nord4/60 truncate max-w-60">{project.manifest.name}</div>
      {items.map((it, i) => (
        <div key={it.id}>
          {it.group && <div role="separator" className="my-1 h-px bg-white/[0.07]" />}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            title={it.hint}
            onMouseEnter={() => setActive(i)}
            onClick={it.run}
            className={cx(
              "w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] text-left transition",
              "disabled:opacity-35 disabled:cursor-not-allowed",
              active === i && !it.disabled && (it.danger ? "bg-nord11/20 text-nord11" : "bg-white/[0.08] text-nord6"),
              it.danger ? "text-nord11/90" : "text-nord5",
            )}
          >
            <span className="w-4 grid place-items-center opacity-80">{it.icon}</span>
            {it.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
