import { CircleCheck, CircleX, Info, X } from "lucide-react";
import { useUI } from "../lib/ui";
import { cx } from "./ui";

export function Toasts() {
  const { toasts, dismiss } = useUI();
  return (
    <div aria-live="polite" className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))]">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="glass-strong rounded-xl px-3.5 py-3 flex items-start gap-2.5 text-[13px]">
          <span className={cx("mt-0.5", t.kind === "error" ? "text-nord11" : t.kind === "success" ? "text-nord14" : "text-nord8")}>
            {t.kind === "error" ? <CircleX size={16} /> : t.kind === "success" ? <CircleCheck size={16} /> : <Info size={16} />}
          </span>
          <span className="text-nord5 break-words min-w-0 flex-1">{t.text}</span>
          {t.action &&
            (t.action.href ? (
              <a className="text-nord8 hover:underline shrink-0" href={t.action.href} onClick={() => dismiss(t.id)}>
                {t.action.label}
              </a>
            ) : (
              <button type="button" className="text-nord8 hover:underline shrink-0" onClick={t.action.onClick}>
                {t.action.label}
              </button>
            ))}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-nord4/50 hover:text-nord5">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
