"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import { useEffect } from "react";
import Link from "next/link";
import { Plus, Download, Search, ArrowUpRight } from "lucide-react";
import type { Entry } from "@/types/domain";
import { Avatar, Badge, Empty, Modal } from "../ui";
import { ActionForm, CaptureForm } from "../forms";
import { Heading } from "./heading";
export function Logs() {
  const { state, site, search, setSearch, toast } = useApp();
  const [type, setType] = useState("All types"),
    [status, setStatus] = useState("All statuses"),
    [equipment, setEquipment] = useState(""),
    [staff, setStaff] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [selected, setSelected] = useState<Entry | null>(null),
    [capture, setCapture] = useState(false),
    [amend, setAmend] = useState(false),
    [rows, setRows] = useState<Entry[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(
      `/api/entries?${new URLSearchParams({ ...(start ? { start: `${start}T00:00:00.000Z` } : {}), ...(end ? { end: `${end}T23:59:59.999Z` } : {}) })}`,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active) {
          setRows(data.items);
          setCursor(data.nextCursor);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [state.entries, start, end]);
  const entries = rows.filter(
    (e) =>
      e.siteId === site &&
      (type === "All types" || e.type === type) &&
      (status === "All statuses" || e.status === status) &&
      (!equipment || e.equipmentId === equipment) &&
      (!staff || e.staff === staff) &&
      `${e.label} ${e.notes} ${e.staff}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const detail = selected
    ? (state.entries.find((e) => e.id === selected.id) ?? selected)
    : null;
  return (
    <>
      <Heading
        title="Logs"
        description="Every check, every reading. A clear, unaltered record."
      >
        <a className="btn" href="/api/export" download>
          <Download size={15} />
          Export CSV
        </a>
        <button className="btn primary" onClick={() => setCapture(true)}>
          <Plus size={15} />
          Add record
        </button>
      </Heading>
      <div className="toolbar">
        <Search size={16} />
        <input
          placeholder="Search notes, staff or equipment"
          aria-label="Filter records"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Record type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {[
            "All types",
            "Temperature",
            "Checklist",
            "Delivery",
            "Cleaning",
            "Corrective action",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Record status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {["All statuses", "Done", "Out of range", "Failed", "Rejected"].map(
            (t) => (
              <option key={t}>{t}</option>
            ),
          )}
        </select>
        <select
          aria-label="Equipment filter"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">All equipment</option>
          {state.equipment.map((e) => (
            <option value={e.id} key={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Staff filter"
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
        >
          <option value="">All staff</option>
          {state.memberships.map((m) => (
            <option key={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          aria-label="Start date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          aria-label="End date"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Time",
                  "Type",
                  "Equipment / template",
                  "Value",
                  "Status",
                  "Staff",
                  "Details",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {new Date(e.serverTimestamp).toLocaleString("en-GB", {
                      timeZone: "UTC",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>{e.type}</td>
                  <td>{e.label}</td>
                  <td>
                    <strong>{e.value}</strong>
                    {e.amendments.length > 0 && <small> · amended</small>}
                  </td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                  <td>
                    <span className="row">
                      <Avatar name={e.staff} />
                      {e.staff}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={() => setSelected(e)}
                      aria-label={`View ${e.label} record`}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? (
          <Empty text="Loading records…" />
        ) : (
          !entries.length && (
            <Empty text="No matching records on this page. Adjust filters or load the next page." />
          )
        )}
        <div className="card-pad row between">
          <small>
            {entries.length} matching records · filters apply to this page
          </small>
          {cursor && (
            <button
              className="btn"
              onClick={async () => {
                setLoading(true);
                try {
                  const q = new URLSearchParams({
                    cursor,
                    ...(start ? { start: `${start}T00:00:00.000Z` } : {}),
                    ...(end ? { end: `${end}T23:59:59.999Z` } : {}),
                  });
                  const r = await fetch(`/api/entries?${q}`);
                  const p = await r.json();
                  if (!r.ok) throw new Error(p.error);
                  setRows(p.items);
                  setCursor(p.nextCursor);
                } catch (e) {
                  toast(
                    e instanceof Error ? e.message : "Unable to load records.",
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              Next 50 records →
            </button>
          )}
        </div>
      </section>
      {capture && <CaptureForm onClose={() => setCapture(false)} />}{" "}
      {detail && !amend && (
        <Modal title="Record details" drawer onClose={() => setSelected(null)}>
          <div className="stack">
            <div className="row between">
              <h2>{detail.label}</h2>
              <Badge status={detail.status} />
            </div>
            <dl className="definition">
              <dt>Original value</dt>
              <dd>
                <strong>{detail.value}</strong>
              </dd>
              <dt>Recorded by</dt>
              <dd>{detail.staff}</dd>
              <dt>Server timestamp</dt>
              <dd>{detail.serverTimestamp}</dd>
              <dt>Device timestamp</dt>
              <dd>{detail.deviceTimestamp}</dd>
              <dt>Template version</dt>
              <dd>{detail.templateVersionId || "Not applicable"}</dd>
              <dt>Notes</dt>
              <dd>{detail.notes || "No notes"}</dd>
              <dt>Attachments</dt>
              <dd>{detail.attachmentIds.length || "No attachments"}</dd>
            </dl>
            {detail.timingFlag && (
              <p className="error">
                Device time differs from server time by over five minutes.
                Review synchronization timing.
              </p>
            )}
            {detail.issueId && (
              <Link className="btn" href="/app/issues">
                View linked issue
              </Link>
            )}
            <h2>Amendment history</h2>
            {detail.amendments.length ? (
              detail.amendments.map((a) => (
                <div className="notice" key={a.id}>
                  <strong>{a.value}</strong>
                  <p>{a.reason}</p>
                  <small>
                    {a.actor} ·{" "}
                    {new Date(a.at).toLocaleString("en-GB", {
                      timeZone: "UTC",
                    })}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">
                No amendments. The original entry is preserved.
              </p>
            )}
            <button className="btn" onClick={() => setAmend(true)}>
              Add an amendment
            </button>
          </div>
        </Modal>
      )}
      {detail && amend && (
        <ActionForm
          title="Amend record"
          onClose={() => setAmend(false)}
          fields={[
            { name: "value", label: "Corrected value" },
            { name: "reason", label: "Reason for amendment", type: "textarea" },
          ]}
          build={(v) => ({ action: "entry.amend", id: detail.id, ...v })}
        />
      )}
    </>
  );
}
