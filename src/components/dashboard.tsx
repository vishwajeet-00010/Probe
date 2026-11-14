"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Plus,
  Download,
  Thermometer,
  Clock3,
  TriangleAlert,
  Check,
  CalendarDays,
  Flame,
  ChevronRight,
} from "lucide-react";
import { useApp } from "./app-provider";
import { Avatar, Badge, Empty } from "./ui";
import { CaptureForm } from "./forms";
export function Dashboard() {
  const { state, site, now } = useApp();
  const [capture, setCapture] = useState<string | null>(null);
  const today = new Date(now).toISOString().slice(0, 10);
  const siteItems = state.dueItems
    .filter((d) => d.siteId === site)
    .map((d) => ({
      ...d,
      status:
        d.status === "Due" && Date.parse(d.dueAt) < now
          ? ("Overdue" as const)
          : d.status,
    }));
  const items = siteItems.filter((d) => d.dueAt.startsWith(today)),
    done = items.filter((d) => d.status === "Done").length,
    total = items.filter((d) => d.status !== "N/A").length,
    percent = total ? Math.round((done / total) * 100) : 0;
  const overdue = siteItems.filter((d) => d.status === "Overdue");
  const issues = state.issues
    .filter(
      (i) =>
        i.siteId === site &&
        i.status !== "Verified" &&
        !(i.status === "Resolved" && i.severity !== "High"),
    )
    .sort(
      (a, b) =>
        ({ High: 0, Medium: 1, Low: 2 })[a.severity] -
        { High: 0, Medium: 1, Low: 2 }[b.severity],
    );
  const entries = state.entries
    .filter((e) => e.siteId === site)
    .sort((a, b) => b.serverTimestamp.localeCompare(a.serverTimestamp));
  const excursions = entries.filter(
    (e) => e.status === "Out of range" && e.serverTimestamp.startsWith(today),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>
            YOUR DAILY OVERVIEW
          </div>
          <h1>A little clarity for your day.</h1>
          <p>
            Here’s how things are looking at{" "}
            {state.sites.find((s) => s.id === site)?.name}.
          </p>
        </div>
        <div className="row">
          <Link href="/app/reports" className="btn">
            <Download size={15} />
            Inspection pack
          </Link>
          <button className="btn primary" onClick={() => setCapture("")}>
            <Plus size={16} />
            Add record
          </button>
        </div>
      </div>
      <div className="row between" style={{ marginBottom: 18 }}>
        <h2>Today at a glance</h2>
        <span className="row muted" style={{ fontSize: 12 }}>
          <CalendarDays size={14} />
          {new Date(now).toLocaleDateString("en-GB", {
            timeZone: "UTC",
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="metric-grid">
        <section className="card metric">
          <div className="row between">
            <div>
              <div className="metric-title">Today’s completion</div>
              <div className="metric-value">
                {done}
                <span
                  style={{
                    fontSize: 17,
                    color: "var(--muted)",
                    fontWeight: 400,
                  }}
                >
                  {" "}
                  / {total}
                </span>
              </div>
              <small>Checks completed</small>
            </div>
            <div className="completion-ring">
              <svg
                width="85"
                height="85"
                viewBox="0 0 85 85"
                aria-hidden="true"
              >
                <circle
                  cx="42.5"
                  cy="42.5"
                  r="35"
                  fill="none"
                  stroke="var(--pale)"
                  strokeWidth="7"
                />
                <circle
                  cx="42.5"
                  cy="42.5"
                  r="35"
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${percent * 2.199} 220`}
                />
              </svg>
              <span>{percent}%</span>
            </div>
          </div>
        </section>
        <section className="card metric">
          <div className="metric-title">
            <Clock3 size={15} />
            Overdue checks
          </div>
          <div className="metric-value">
            {overdue.length.toString().padStart(2, "0")}
          </div>
          <small>
            {overdue.length
              ? "A quick check-in needed"
              : "Everything is up to date"}
          </small>
        </section>
        <section className="card metric">
          <div className="metric-title">
            <Thermometer size={15} />
            Out-of-range readings
          </div>
          <div className="metric-value">
            {excursions.length.toString().padStart(2, "0")}
          </div>
          <small>
            {excursions.length
              ? "Requires your attention"
              : "No excursions today"}
          </small>
        </section>
        <section className="card metric">
          <div className="metric-title">
            <TriangleAlert size={15} />
            Open issues
          </div>
          <div className="metric-value">
            {issues.length.toString().padStart(2, "0")}
          </div>
          <small>
            {issues.filter((i) => i.severity === "High").length} high priority
          </small>
        </section>
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <section className="card">
            <div className="card-head">
              <div className="row">
                <h2>Needs attention</h2>
                <span className="badge red">
                  {issues.length + overdue.length}
                </span>
              </div>
              <Link
                href="/app/issues"
                className="row muted"
                style={{ fontSize: 11 }}
              >
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {issues.slice(0, 3).map((i) => (
              <div key={i.id} className="attention-item">
                <span className="attention-icon">
                  <Thermometer size={17} />
                </span>
                <div style={{ flex: 1 }}>
                  <div className="row between">
                    <h3>{i.title}</h3>
                    <Badge status={i.severity} />
                  </div>
                  <p>{i.timeline.at(-1)?.note}</p>
                  <Link href="/app/issues">
                    Review issue <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            ))}
            {overdue.slice(0, 2).map((d) => (
              <div key={d.id} className="attention-item">
                <span
                  className="attention-icon"
                  style={{ background: "#faf1df", color: "#8c6221" }}
                >
                  <Clock3 size={17} />
                </span>
                <div style={{ flex: 1 }}>
                  <h3>{d.title}</h3>
                  <p>Scheduled check · Assigned to {d.assignedTo}</p>
                </div>
                <button className="btn" onClick={() => setCapture(d.id)}>
                  Log check
                </button>
              </div>
            ))}
            {!issues.length && !overdue.length && (
              <Empty text="All caught up. Nothing needs your attention." />
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Today’s timeline</h2>
                <small>A clear view of your daily checks</small>
              </div>
              <span className="badge neutral">{items.length} checks</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Check</th>
                    <th>Status</th>
                    <th>Assigned to</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          className="icon-btn"
                          style={{
                            padding: 0,
                            color: "var(--ink)",
                            fontSize: 12,
                          }}
                          onClick={() =>
                            d.status !== "Done" && setCapture(d.id)
                          }
                          disabled={d.status === "Done"}
                        >
                          {d.status === "Done" ? (
                            <Check size={14} />
                          ) : (
                            <Clock3 size={14} />
                          )}
                          <span style={{ marginLeft: 8 }}>{d.title}</span>
                        </button>
                      </td>
                      <td>
                        <Badge status={d.status} />
                      </td>
                      <td>
                        <span className="row" style={{ gap: 7 }}>
                          <Avatar name={d.assignedTo} />
                          <span>{d.assignedTo.split(" ")[0]}</span>
                        </span>
                      </td>
                      <td className="muted">
                        {new Date(d.completedAt ?? d.dueAt).toLocaleTimeString(
                          "en-GB",
                          {
                            timeZone: "UTC",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!items.length && (
              <Empty text="No scheduled checks yet. Create templates to begin planning your day." />
            )}
            <div
              style={{
                padding: 14,
                textAlign: "center",
                borderTop: "1px solid var(--line)",
              }}
            >
              <Link
                href="/app/checklists"
                className="muted"
                style={{ fontSize: 12 }}
              >
                View all checklists{" "}
                <ChevronRight size={12} style={{ display: "inline" }} />
              </Link>
            </div>
          </section>
        </div>
        <div className="stack" style={{ alignContent: "start" }}>
          <section className="card card-pad">
            <div className="row between">
              <h2>Last 7 days</h2>
              <span className="badge neutral">Record outcomes</span>
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 5 }}>
              Successful records as a share of recorded checks
            </p>
            <div className="chart-grid">
              <div
                className="chart"
                role="img"
                aria-label="Daily successful-record percentages for the last seven days"
              >
                {Array.from({ length: 7 }, (_, i) => {
                  const date = new Date(now);
                  date.setUTCDate(date.getUTCDate() - 6 + i);
                  const day = date.toISOString().slice(0, 10),
                    records = entries.filter((e) =>
                      e.serverTimestamp.startsWith(day),
                    ),
                    p = records.length
                      ? Math.round(
                          (records.filter((e) => e.status === "Done").length /
                            records.length) *
                            100,
                        )
                      : 0;
                  return (
                    <div className="bar-column" key={day}>
                      <span>{records.length ? `${p}%` : "—"}</span>
                      <div className="bar" style={{ height: `${p}px` }} />
                      <span>
                        {date.toLocaleDateString("en-GB", {
                          timeZone: "UTC",
                          weekday: "short",
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="chart-summary">
              <span className="row">
                <Flame size={16} />
                Keep the routine going
              </span>
              <span className="muted">One check at a time</span>
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Recent activity</h2>
              <Link
                href="/app/logs"
                className="muted"
                aria-label="View all activity"
              >
                <ArrowRight size={15} />
              </Link>
            </div>
            {entries.slice(0, 5).map((e) => (
              <div className="activity" key={e.id}>
                <Avatar name={e.staff} />
                <div>
                  <p>
                    <strong>{e.staff.split(" ")[0]}</strong> logged{" "}
                    {e.label.toLowerCase()}
                  </p>
                  <small>
                    {e.value} ·{" "}
                    {new Date(e.serverTimestamp).toLocaleTimeString("en-GB", {
                      timeZone: "UTC",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              </div>
            ))}
          </section>
          <div className="card card-pad" style={{ background: "var(--pale)" }}>
            <div className="eyebrow">READY WHEN YOU NEED IT</div>
            <h2 style={{ margin: "10px 0" }}>Your records. All together.</h2>
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Turn daily checks into a clear inspection pack in a few clicks.
            </p>
            <Link
              href="/app/reports"
              className="row"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Build an inspection pack <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 10, marginTop: 24 }}>
        Completion measures your scheduled checks. It is not a legal compliance
        rating.
      </p>
      {capture !== null && (
        <CaptureForm
          dueItemId={capture || undefined}
          onClose={() => setCapture(null)}
        />
      )}
    </>
  );
}
