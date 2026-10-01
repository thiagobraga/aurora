import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Project } from "../types";

export type DialogKind = "tools" | "tests" | "coverage" | "rename" | "remove" | "database";

interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

interface UI {
  toasts: Toast[];
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
  jobId?: string;
  showJob: (id?: string) => void;
  dialog?: { kind: DialogKind; project: Project };
  openDialog: (kind: DialogKind, project: Project) => void;
  closeDialog: () => void;
  menu?: { x: number; y: number; project: Project };
  openMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, project: Project) => void;
  closeMenu: () => void;
}

const Ctx = createContext<UI | null>(null);
let seq = 0;

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [jobId, setJobId] = useState<string>();
  const [dialog, setDialog] = useState<UI["dialog"]>();
  const [menu, setMenu] = useState<UI["menu"]>();

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.action ? 12_000 : 5000);
    },
    [dismiss],
  );

  const value = useMemo<UI>(
    () => ({
      toasts,
      toast,
      dismiss,
      jobId,
      showJob: setJobId,
      dialog,
      openDialog: (kind, project) => {
        setMenu(undefined);
        setDialog({ kind, project });
      },
      closeDialog: () => setDialog(undefined),
      menu,
      openMenu: (e, project) => {
        e.preventDefault?.();
        setMenu({ x: e.clientX, y: e.clientY, project });
      },
      closeMenu: () => setMenu(undefined),
    }),
    [toasts, toast, dismiss, jobId, dialog, menu],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI outside UIProvider");
  return v;
}
