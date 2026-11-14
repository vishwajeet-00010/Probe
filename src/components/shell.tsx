"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  TriangleAlert,
  FileChartColumn,
  Truck,
  Thermometer,
  Users,
  Settings,
  Search,
  Bell,
  ChevronDown,
  MapPin,
  Menu,
  X,
  Moon,
  LogOut,
  CircleHelp,
  ArrowUpRight,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Avatar, Brand } from "./ui";
const links = [
  ["Dashboard", "dashboard", LayoutDashboard],
  ["Logs", "logs", ClipboardList],
  ["Checklists", "checklists", ListChecks],
  ["Issues", "issues", TriangleAlert],
  ["Reports", "reports", FileChartColumn],
  ["Suppliers", "suppliers", Truck],
  ["Equipment", "equipment", Thermometer],
  ["Team", "team", Users],
  ["Settings", "settings", Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { state, actor, site, setSite, search, setSearch } = useApp(),
    pathname = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="row between">
          <Brand />
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace row">
          <span className="avatar">GT</span>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {state.organization.name}
            </h3>
            <small>Workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {links.map(([label, path, Icon]) => (
            <Link
              key={path}
              href={`/app/${path}`}
              onClick={() => setOpen(false)}
              className={`nav-link ${pathname.startsWith(`/app/${path}`) ? "active" : ""}`}
              aria-current={
                pathname.startsWith(`/app/${path}`) ? "page" : undefined
              }
            >
              <Icon size={17} strokeWidth={1.7} />
              {label}
              {path === "issues" &&
                state.issues.filter((i) => i.status === "Open").length > 0 && (
                  <span className="badge red">
                    {state.issues.filter((i) => i.status === "Open").length}
                  </span>
                )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trial-card">
            <div className="row between">
              <strong>Your workspace, upgraded</strong>
              <ArrowUpRight size={14} />
            </div>
            <p className="muted" style={{ margin: "7px 0 12px" }}>
              Explore Pro with your 14-day trial.
            </p>
            <Link
              href="/app/settings/billing"
              className="btn"
              style={{ width: "100%" }}
            >
              View plans
            </Link>
          </div>
          <Link href="/guides" className="nav-link">
            <CircleHelp size={17} />
            Help & resources
          </Link>
          <div
            className="row"
            style={{ padding: 12, borderTop: "1px solid var(--line)" }}
          >
            <Avatar name={actor.name} />
            <div>
              <h3 style={{ fontSize: 12 }}>{actor.name}</h3>
              <small>{actor.role}</small>
            </div>
            <button
              className="icon-btn"
              aria-label="Sign out"
              onClick={async () => {
                await fetch("/api/session", { method: "DELETE" });
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="shell-body">
        <header className="topbar">
          <div className="row">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
            <MapPin size={16} />
            <select
              aria-label="Current site"
              className="site-select"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              {state.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <form
              className="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push("/app/logs");
              }}
            >
              <Search size={16} />
              <input
                aria-label="Search logs"
                placeholder="Search records, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <button
              className="icon-btn"
              aria-label="Toggle dark mode"
              onClick={() => document.documentElement.classList.toggle("dark")}
            >
              <Moon size={17} />
            </button>
            <Link
              href="/app/notifications"
              className="icon-btn"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {state.notifications.some(
                (n) => !n.readBy.includes(actor.uid),
              ) && (
                <span
                  aria-label="Unread notifications"
                  style={{
                    width: 5,
                    height: 5,
                    background: "var(--green)",
                    borderRadius: "50%",
                    alignSelf: "start",
                  }}
                />
              )}
            </Link>
            <Avatar name={actor.name} />
          </div>
        </header>
        {actor.demo && (
          <div className="demo-strip">
            <span>DEMO WORKSPACE · Sample records, safe to explore</span>
            <Link href="/signup">Set up your business →</Link>
          </div>
        )}
        <main id="main" className="content">
          {children}
          <p className="muted" style={{ fontSize: 10, marginTop: 24 }}>
            Record dates and times shown in UTC.
          </p>
        </main>
      </div>
    </div>
  );
}
