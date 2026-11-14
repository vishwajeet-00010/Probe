"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import { Plus, Thermometer, MapPin, Archive, ArrowUpRight } from "lucide-react";
import type { Equipment } from "@/types/domain";
import { Badge, Empty, Modal } from "../ui";
import { ActionForm } from "../forms";
import { Heading } from "./heading";
export function EquipmentPage() {
  const { state, site, run, toast, now } = useApp();
  const [add, setAdd] = useState(false),
    [selected, setSelected] = useState<Equipment | null>(null),
    [archived, setArchived] = useState(false),
    [days, setDays] = useState(7);
  const records = state.equipment.filter(
    (e) => e.siteId === site && e.archived === archived,
  );
  return (
    <>
      <Heading
        title="Equipment"
        description="Keep an eye on the things that keep your food safe."
      >
        <button className="btn primary" onClick={() => setAdd(true)}>
          <Plus size={16} />
          Add equipment
        </button>
      </Heading>
      <div className="toolbar">
        <button className="btn" onClick={() => setArchived(!archived)}>
          <Archive size={15} />
          {archived ? "View active equipment" : "View archived"}
        </button>
        <small>
          {records.length} {archived ? "archived" : "active"} pieces of
          equipment
        </small>
      </div>
      <div className="equipment-grid">
        {records.map((e) => {
          const readings = state.entries
            .filter((r) => r.equipmentId === e.id && r.numericValue !== null)
            .sort((a, b) => b.serverTimestamp.localeCompare(a.serverTimestamp));
          const latest = readings[0];
          return (
            <article key={e.id} className="card card-pad">
              <div className="row between">
                <span className="metric-icon">
                  <Thermometer size={20} />
                </span>
                <Badge status={latest?.status ?? "No reading"} />
              </div>
              <h2 style={{ marginTop: 20 }}>{e.name}</h2>
              <p className="muted row" style={{ fontSize: 12, marginTop: 4 }}>
                <MapPin size={12} />
                {e.location} · {e.type}
              </p>
              <div className="equipment-temp">{latest?.value ?? "—"}</div>
              <small>Latest recorded temperature</small>
              <TemperatureChart
                values={readings
                  .slice(0, 7)
                  .reverse()
                  .map((r) => r.numericValue!)}
                min={e.min}
                max={e.max}
              />
              <div className="row between equipment-footer">
                <span className="muted">
                  Safe range {e.min} to {e.max} °C
                </span>
                <button
                  className="icon-btn"
                  aria-label={`View ${e.name}`}
                  onClick={() => setSelected(e)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!records.length && <Empty />}
      {add && (
        <ActionForm
          title="Add equipment"
          onClose={() => setAdd(false)}
          fields={[
            { name: "name", label: "Name" },
            {
              name: "type",
              label: "Equipment type",
              type: "select",
              options: [
                "Fridge",
                "Freezer",
                "Hot Hold",
                "Display Chiller",
                "Cooking Core",
                "Delivery",
              ].map((t) => ({ value: t, label: t })),
            },
            { name: "location", label: "Location" },
            {
              name: "frequency",
              label: "Check frequency",
              value: "Twice daily",
            },
            {
              name: "min",
              label: "Safe minimum (°C)",
              type: "number",
              value: 0,
            },
            {
              name: "max",
              label: "Safe maximum (°C)",
              type: "number",
              value: 5,
            },
          ]}
          build={(v) => ({
            action: "equipment.create",
            ...v,
            siteId: site,
            min: Number(v.min),
            max: Number(v.max),
          })}
        />
      )}{" "}
      {selected && (
        <Modal title={selected.name} drawer onClose={() => setSelected(null)}>
          <div className="stack">
            <div className="row">
              {[7, 30, 90].map((d) => (
                <button
                  className={`btn ${days === d ? "primary" : ""}`}
                  key={d}
                  onClick={() => setDays(d)}
                >
                  {d} days
                </button>
              ))}
            </div>
            <TemperatureChart
              min={selected.min}
              max={selected.max}
              values={state.entries
                .filter(
                  (e) =>
                    e.equipmentId === selected.id &&
                    e.numericValue !== null &&
                    Date.parse(e.serverTimestamp) > now - days * 86400000,
                )
                .sort((a, b) =>
                  a.serverTimestamp.localeCompare(b.serverTimestamp),
                )
                .map((e) => e.numericValue!)}
            />
            <p className="muted">
              Safe range: {selected.min} to {selected.max} °C. Chart uses the
              latest 100 loaded records.
            </p>
            <dl className="definition">
              <dt>Type</dt>
              <dd>{selected.type}</dd>
              <dt>Location</dt>
              <dd>{selected.location}</dd>
              <dt>Frequency</dt>
              <dd>{selected.frequency}</dd>
            </dl>
            <div className="notice">
              Printable QR labels are planned. Equipment ID: {selected.id}
            </div>
            {!selected.archived && (
              <button
                className="btn danger"
                onClick={async () => {
                  try {
                    await run({ action: "equipment.archive", id: selected.id });
                    setSelected(null);
                  } catch {
                    toast("Equipment could not be archived.");
                  }
                }}
              >
                <Archive size={15} />
                Archive equipment
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export function TemperatureChart({
  values,
  min,
  max,
}: {
  values: number[];
  min: number;
  max: number;
}) {
  const low = Math.min(min, ...values) - 2,
    high = Math.max(max, ...values) + 2,
    y = (v: number) => 60 - ((v - low) / (high - low)) * 55;
  return (
    <svg
      className="sparkline"
      viewBox="0 0 300 70"
      role="img"
      aria-label={`Temperature readings: ${values.join(", ") || "none"}. Safe range ${min} to ${max} degrees Celsius.`}
    >
      <rect
        x="0"
        y={y(max)}
        width="300"
        height={y(min) - y(max)}
        fill="var(--pale)"
      />
      <line
        x1="0"
        x2="300"
        y1={y(max)}
        y2={y(max)}
        stroke="#b8cbb7"
        strokeDasharray="4 4"
      />
      <polyline
        fill="none"
        stroke="var(--green)"
        strokeWidth="2"
        points={values
          .map(
            (v, i) =>
              `${10 + (i * 280) / Math.max(1, values.length - 1)},${y(v)}`,
          )
          .join(" ")}
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={10 + (i * 280) / Math.max(1, values.length - 1)}
          cy={y(v)}
          r="3"
          fill={v < min || v > max ? "#b94b3d" : "var(--green)"}
        />
      ))}
    </svg>
  );
}
