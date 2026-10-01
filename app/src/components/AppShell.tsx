import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Gauge, LayoutGrid, Menu, PanelLeftClose, PanelLeftOpen, Plus, Settings, Star, X } from "lucide-react";
import { useAppState, usePatchState, useProjects } from "../api/hooks";
import { useLive } from "../lib/live";
import { useUI } from "../lib/ui";
import { ContextMenu } from "./ContextMenu";
import { GlobalDialogs } from "./Dialogs";
import { JobPanel } from "./JobPanel";
import { ProjectIcon } from "./ProjectCard";
import { StatusDot } from "./StatusPill";
import { Toasts } from "./Toasts";
import { cx, IconButton } from "./ui";

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-1" aria-label="Aurora home">
      <img src="/favicon.svg" alt="" className="size-8 shrink-0" />
      {!collapsed && <span className="font-display text-lg tracking-tight aurora-text">aurora</span>}
    </Link>
  );
}

function NavItem({ to, icon, label, collapsed, end }: { to: string; icon: ReactNode; label: string; collapsed: boolean; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cx(
          "flex items-center gap-3 h-9 rounded-lg text-[13px] transition",
          collapsed ? "justify-center px-0" : "px-3",
          isActive ? "bg-nord8/15 text-nord6 shadow-[inset_2px_0_0_var(--color-nord8)]" : "text-nord4/75 hover:text-nord6 hover:bg-white/[0.05]",
        )
      }
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && label}
    </NavLink>
  );
}

function Sidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const { data: st } = useAppState();
  const { data } = useProjects();
  const { status, connected } = useLive();
  const ui = useUI();
  const favs = (st?.state.favorites ?? []).map((s) => data?.projects.find((p) => p.slug === s)).filter((p) => !!p);

  return (
    <nav aria-label="Main" className="h-full flex flex-col gap-6 p-3" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <div className={cx("flex items-center pt-1", collapsed ? "justify-center" : "justify-between")}>
        <Logo collapsed={collapsed} />
        {onToggle && !collapsed && (
          <IconButton label="Collapse sidebar" onClick={onToggle}>
            <PanelLeftClose size={16} />
          </IconButton>
        )}
      </div>

      <div className="space-y-1">
        <NavItem to="/" end icon={<LayoutGrid size={16} />} label="Dashboard" collapsed={collapsed} />
        <NavItem to="/new" icon={<Plus size={16} />} label="New project" collapsed={collapsed} />
        <NavItem to="/system" icon={<Gauge size={16} />} label="System" collapsed={collapsed} />
        <NavItem to="/settings" icon={<Settings size={16} />} label="Settings" collapsed={collapsed} />
      </div>

      <div className="min-h-0 flex-1 flex flex-col">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 mb-2 text-[10px] uppercase tracking-[0.16em] text-nord4/50">
            <Star size={11} /> Favorites
          </div>
        )}
        <div className="space-y-0.5 overflow-auto -mx-1 px-1">
          {favs.map((p) => (
            <NavLink
              key={p.slug}
              to={`/projects/${p.slug}`}
              title={p.manifest.name}
              onContextMenu={(e) => ui.openMenu(e, p)}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-2.5 h-9 rounded-lg text-[13px] transition",
                  collapsed ? "justify-center" : "px-2",
                  isActive ? "bg-white/[0.07] text-nord6" : "text-nord4/80 hover:bg-white/[0.04] hover:text-nord6",
                )
              }
            >
              <ProjectIcon project={p} size={22} />
              {!collapsed && <span className="truncate flex-1">{p.manifest.name}</span>}
              {!collapsed && <StatusDot status={status[p.slug]} />}
            </NavLink>
          ))}
          {!favs.length && !collapsed && <p className="px-3 text-[11px] text-nord4/40 leading-relaxed">Star a project to pin it here.</p>}
        </div>
      </div>

      <div className={cx("flex items-center gap-2 text-[11px] text-nord4/50", collapsed ? "justify-center flex-col" : "px-3")}>
        <span className={cx("size-1.5 rounded-full", connected ? "bg-nord14" : "bg-nord11")} />
        {!collapsed && (connected ? "Live" : "Offline")}
        {onToggle && collapsed && (
          <IconButton label="Expand sidebar" onClick={onToggle}>
            <PanelLeftOpen size={16} />
          </IconButton>
        )}
      </div>
    </nav>
  );
}

export function AppShell() {
  const { data: st } = useAppState();
  const patch = usePatchState();
  const collapsed = st?.state.sidebarCollapsed ?? false;
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

  return (
    <div className="min-h-dvh flex">
      <aside
        className={cx(
          "hidden md:block sticky top-0 h-dvh shrink-0 border-r border-white/[0.06] bg-nord0/30 backdrop-blur-xl transition-[width] duration-200",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} onToggle={() => patch.mutate({ sidebarCollapsed: !collapsed })} />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-night/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 glass-strong">
            <div className="absolute top-3 right-3">
              <IconButton label="Close menu" onClick={() => setMobileOpen(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-nord0/60 backdrop-blur-xl border-b border-white/[0.06]">
          <IconButton label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu size={18} />
          </IconButton>
          <Logo />
        </div>
        <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] mx-auto">
          <Outlet />
        </main>
      </div>

      <ContextMenu />
      <GlobalDialogs />
      <JobPanel />
      <Toasts />
    </div>
  );
}
