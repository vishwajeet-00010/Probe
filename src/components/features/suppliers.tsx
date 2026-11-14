"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Empty } from "../ui";
import { ActionForm } from "../forms";
import { Heading } from "./heading";
export function Suppliers() {
  const { state } = useApp(),
    [add, setAdd] = useState(false);
  return (
    <>
      <Heading
        title="Suppliers"
        description="Know your suppliers. Keep delivery records close."
      >
        <button className="btn primary" onClick={() => setAdd(true)}>
          <Plus size={16} />
          Add supplier
        </button>
      </Heading>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Supplier",
                "Categories",
                "Contact",
                "Deliveries",
                "Rejection rate",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.suppliers.map((s) => {
              const deliveries = state.entries.filter(
                (e) => e.type === "Delivery" && e.supplierId === s.id,
              );
              return (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <p className="muted" style={{ fontSize: 11 }}>
                      {s.notes}
                    </p>
                  </td>
                  <td>{s.categories}</td>
                  <td>
                    {s.email}
                    <p className="muted">{s.phone}</p>
                  </td>
                  <td>{deliveries.length}</td>
                  <td>
                    {deliveries.length
                      ? `${Math.round((deliveries.filter((e) => e.status === "Rejected").length / deliveries.length) * 100)}%`
                      : "No deliveries yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!state.suppliers.length && <Empty />}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        Rates use currently loaded delivery records.{" "}
        <Link href="/app/logs">View delivery records →</Link>
      </p>
      {add && (
        <ActionForm
          title="Add supplier"
          onClose={() => setAdd(false)}
          fields={[
            { name: "name", label: "Supplier name" },
            { name: "categories", label: "Categories" },
            { name: "email", label: "Email", type: "email", required: false },
            { name: "phone", label: "Phone", required: false },
            {
              name: "notes",
              label: "Notes",
              type: "textarea",
              required: false,
            },
          ]}
          build={(v) => ({ action: "supplier.create", ...v })}
        />
      )}
    </>
  );
}
