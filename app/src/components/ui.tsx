import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "ghost" | "danger" | "glass";

export function buttonClass(variant: Variant = "glass", size: "sm" | "md" = "md", className?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition select-none whitespace-nowrap",
    "disabled:opacity-40 disabled:pointer-events-none",
    size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-4 text-[13px]",
    variant === "primary" && "bg-nord8 text-nord0 hover:bg-nord7 shadow-[0_6px_20px_-8px_rgb(136_192_208/0.7)]",
    variant === "glass" && "bg-nord1/50 hover:bg-nord2/70 border border-white/[0.07] text-nord5 backdrop-blur",
    variant === "ghost" && "hover:bg-white/[0.06] text-nord4",
    variant === "danger" && "bg-nord11/90 hover:bg-nord11 text-nord6",
    className,
  );
}

export function Button({
  variant = "glass",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button type="button" {...rest} className={buttonClass(variant, size, className)}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx("inline-grid place-items-center size-8 rounded-lg text-nord4 hover:text-nord6 hover:bg-white/[0.08] transition disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] leading-4 bg-nord0/50 border border-white/[0.08] text-nord5 backdrop-blur-sm", className)}>
      {children}
    </span>
  );
}

/** True/false as SVG marks (never glyphs). */
export function BoolIcon({ value, manual, size = 18 }: { value: boolean; manual?: boolean; size?: number }) {
  return (
    <span className="relative inline-grid place-items-center" title={`${value ? "Yes" : "No"}${manual ? " (set manually)" : " (detected)"}`}>
      {value ? (
        <svg width={size} height={size} viewBox="0 0 20 20" aria-label="Yes">
          <circle cx="10" cy="10" r="9" fill="rgb(163 190 140 / 0.16)" stroke="#A3BE8C" strokeWidth="1.2" />
          <path d="M6 10.4l2.6 2.6L14.2 7.4" fill="none" stroke="#A3BE8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 20 20" aria-label="No">
          <circle cx="10" cy="10" r="9" fill="rgb(191 97 106 / 0.10)" stroke="rgb(191 97 106 / 0.55)" strokeWidth="1.2" />
          <path d="M7 7l6 6M13 7l-6 6" fill="none" stroke="rgb(191 97 106 / 0.85)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      {manual && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-nord13" />}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg p-0.5 bg-nord0/50 border border-white/[0.07]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.label}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs transition",
            value === o.value ? "bg-nord2/80 text-nord6 shadow" : "text-nord4/70 hover:text-nord5",
          )}
        >
          {o.icon}
          {o.icon ? <span className="sr-only sm:not-sr-only">{o.label}</span> : o.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-night/70 backdrop-blur-sm pointer-events-none" />
      <div ref={ref} role="dialog" aria-modal aria-labelledby={id} className={cx("relative w-full glass-strong rounded-2xl", width)}>
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-white/[0.06]">
          <h2 id={id} className="font-display text-sm text-nord6 tracking-tight">
            {title}
          </h2>
          <IconButton label="Close" data-close onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider text-nord4/60">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-nord4/50">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full h-9 rounded-lg bg-nord0/60 border border-white/[0.08] px-3 text-[13px] text-nord6 placeholder:text-nord3 focus:border-nord8/60 focus:outline-none focus:ring-2 focus:ring-nord8/20 transition";

export function Panel({ title, icon, actions, children, className }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("glass rounded-2xl", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <h3 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-nord4/70">
            {icon}
            {title}
          </h3>
          {actions}
        </header>
      )}
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center text-center py-16 gap-3">
      {icon && <div className="text-nord3">{icon}</div>}
      <p className="font-display text-nord5">{title}</p>
      {children && <div className="text-xs text-nord4/60 max-w-sm">{children}</div>}
    </div>
  );
}
