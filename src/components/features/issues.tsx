"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import { Plus, LayoutGrid, List } from "lucide-react";
import type { Issue } from "@/types/domain";
import { Avatar, Badge, Field, Modal } from "../ui";
import { ActionForm } from "../forms";
import { Heading } from "./heading";
export function Issues() {
  const { state, site, actor, now } = useApp();
  const [board, setBoard] = useState(true),
    [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Issue | null>(null),
    [severity, setSeverity] = useState("All severities");
  const issues = state.issues.filter(
    (i) =>
      i.siteId === site &&
      (severity === "All severities" || i.severity === severity),
  );
  const card = (i: Issue) => (
    <button
      className="card card-pad"
      key={i.id}
      style={{ width: "100%", textAlign: "left" }}
      onClick={() => setSelected(i)}
    >
      <div className="row between">
        <Badge status={i.severity} />
        <small>
          {Math.max(0, Math.floor((now - Date.parse(i.createdAt)) / 86400000))}d
          old
        </small>
      </div>
      <h3 style={{ margin: "14px 0" }}>{i.title}</h3>
      <p className="muted" style={{ fontSize: 11, marginBottom: 12 }}>
        {i.timeline.at(-1)?.note}
      </p>
      <div className="row">
        <Avatar name={i.assignee} />
        <small>{i.assignee}</small>
      </div>
      {i.status === "Resolved" && i.severity === "High" && (
        <p className="badge amber" style={{ marginTop: 12 }}>
          Manager verification required
        </p>
      )}
    </button>
  );
  return (
    <>
      <Heading
        title="Issues & corrective actions"
        description="Spot it, address it, and keep the evidence together."
      >
        <button className="btn primary" onClick={() => setAdd(true)}>
          <Plus size={16} />
          Create issue
        </button>
      </Heading>
      <div className="toolbar">
        <select
          aria-label="Filter severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          {["All severities", "High", "Medium", "Low"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button className="btn" onClick={() => setBoard(!board)}>
          {board ? <List size={16} /> : <LayoutGrid size={16} />}{" "}
          {board ? "List view" : "Board view"}
        </button>
      </div>
      {board ? (
        <div className="kanban">
          {(["Open", "In Progress", "Resolved", "Verified"] as const).map(
            (status) => (
              <section className="kanban-column" key={status}>
                <h2>
                  {status}{" "}
                  <span className="muted">
                    {issues.filter((i) => i.status === status).length}
                  </span>
                </h2>
                {issues.filter((i) => i.status === status).map(card)}
              </section>
            ),
          )}
        </div>
      ) : (
        <div className="equipment-grid">{issues.map(card)}</div>
      )}
      {add && (
        <ActionForm
          title="Create issue"
          onClose={() => setAdd(false)}
          fields={[
            { name: "title", label: "Issue title" },
            {
              name: "severity",
              label: "Severity",
              type: "select",
              options: ["Low", "Medium", "High"].map((v) => ({
                value: v,
                label: v,
              })),
            },
            {
              name: "assignee",
              label: "Assignee",
              type: "select",
              options: state.memberships
                .filter((m) => m.status === "Active")
                .map((m) => ({ value: m.name, label: m.name })),
            },
            { name: "dueAt", label: "Due date", type: "datetime-local" },
          ]}
          build={(v) => ({
            action: "issue.create",
            ...v,
            siteId: site,
            dueAt: new Date(v.dueAt).toISOString(),
          })}
        />
      )}{" "}
      {selected && (
        <IssueDialog
          issue={state.issues.find((i) => i.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          actor={actor.name}
        />
      )}
    </>
  );
}
function IssueDialog({
  issue,
  onClose,
}: {
  issue: Issue;
  onClose: () => void;
  actor: string;
}) {
  const { run, busy } = useApp(),
    [error, setError] = useState("");
  return (
    <Modal title={issue.title} drawer onClose={onClose}>
      <div className="stack">
        <div className="row">
          <Badge status={issue.severity} />
          <Badge status={issue.status} />
        </div>
        <h2>Corrective-action timeline</h2>
        {issue.timeline.map((t, i) => (
          <div key={i} className="notice">
            <strong>
              {t.status} · {t.actor}
            </strong>
            <p>{t.note}</p>
            <small>
              {new Date(t.at).toLocaleString("en-GB", { timeZone: "UTC" })}
            </small>
          </div>
        ))}
        {issue.status !== "Verified" && (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await run({
                  action: "issue.transition",
                  id: issue.id,
                  status: f.get("status"),
                  note: f.get("note"),
                });
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to update.");
              }
            }}
          >
            <Field label="Next status">
              <select name="status">
                {issue.status === "Open" && <option>In Progress</option>}
                {["Open", "In Progress"].includes(issue.status) && (
                  <option>Resolved</option>
                )}
                {issue.status === "Resolved" && <option>Verified</option>}
              </select>
            </Field>
            <Field label="Corrective-action / verification note">
              <textarea name="note" required minLength={3} />
            </Field>
            {issue.severity === "High" && (
              <p className="muted">
                High-severity issues remain in Needs Attention until a manager
                verifies them.
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <button className="btn primary" disabled={busy}>
              Update issue
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
