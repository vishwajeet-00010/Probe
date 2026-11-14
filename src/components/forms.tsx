"use client";
import { useState } from "react";
import { useApp } from "./app-provider";
import { Field, Modal } from "./ui";
export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "email"
    | "date"
    | "datetime-local"
    | "time"
    | "textarea"
    | "select";
  value?: string | number;
  options?: { value: string; label: string }[];
  required?: boolean;
};
export function ActionForm({
  title,
  fields,
  build,
  onClose,
  path,
  submitLabel = "Save changes",
}: {
  title: string;
  fields: FormField[];
  build: (values: Record<string, string>) => unknown;
  onClose: () => void;
  path?: string;
  submitLabel?: string;
}) {
  const { run, busy } = useApp(),
    [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          const values = Object.fromEntries(
            new FormData(e.currentTarget).entries(),
          ) as Record<string, string>;
          try {
            await run(build(values), path);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save.");
          }
        }}
      >
        <div className="form-grid">
          {fields.map((f) => (
            <Field key={f.name} label={f.label}>
              {f.type === "select" ? (
                <select
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required !== false}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value}
                  required={f.required !== false}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  defaultValue={f.value}
                  step={f.type === "number" ? "any" : undefined}
                  required={f.required !== false}
                />
              )}
            </Field>
          ))}
        </div>
        {error && (
          <p className="error" role="alert" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function CaptureForm({
  onClose,
  dueItemId,
}: {
  onClose: () => void;
  dueItemId?: string;
}) {
  const { state, site } = useApp();
  const due = state.dueItems.find((d) => d.id === dueItemId);
  return (
    <ActionForm
      title="Add a record"
      submitLabel="Save record"
      onClose={onClose}
      fields={[
        {
          name: "type",
          label: "Record type",
          type: "select",
          value: due?.equipmentId
            ? "Temperature"
            : due?.templateVersionId
              ? "Checklist"
              : "Temperature",
          options: [
            "Temperature",
            "Checklist",
            "Delivery",
            "Cleaning",
            "Corrective action",
          ].map((v) => ({ value: v, label: v })),
        },
        {
          name: "equipmentId",
          label: "Equipment",
          type: "select",
          value: due?.equipmentId,
          options: [
            { value: "", label: "Not applicable" },
            ...state.equipment
              .filter((e) => e.siteId === site && !e.archived)
              .map((e) => ({ value: e.id, label: e.name })),
          ],
          required: false,
        },
        { name: "value", label: "Reading (°C) or result" },
        {
          name: "supplierId",
          label: "Supplier (delivery records)",
          type: "select",
          required: false,
          options: [
            { value: "", label: "Not applicable" },
            ...state.suppliers.map((s) => ({ value: s.id, label: s.name })),
          ],
        },
        {
          name: "failed",
          label: "Check result",
          type: "select",
          options: [
            { value: "false", label: "Passed / accepted" },
            { value: "true", label: "Failed / rejected" },
          ],
        },
        {
          name: "notes",
          label: "Notes / corrective action",
          type: "textarea",
          required: false,
        },
      ]}
      build={(v) => ({
        action: "entry.create",
        id: crypto.randomUUID(),
        siteId: site,
        equipmentId: v.equipmentId,
        type: v.type,
        value: v.value,
        notes: v.notes,
        failed: v.failed === "true",
        supplierId: v.supplierId,
        deviceTimestamp: new Date().toISOString(),
        dueItemId,
      })}
    />
  );
}
