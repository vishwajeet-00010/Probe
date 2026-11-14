"use client";
import { useApp } from "../app-provider";
import { Heading } from "./heading";
export function AuditLog() {
  const { state } = useApp();
  return (
    <>
      <Heading
        title="Audit log"
        description="A record of who changed what, and when."
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {["Timestamp", "Actor", "Action", "Entity", "Details"].map(
                (t) => (
                  <th key={t}>{t}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {state.auditEvents.map((e) => (
              <tr key={e.id}>
                <td>
                  {new Date(e.at).toLocaleString("en-GB", { timeZone: "UTC" })}
                </td>
                <td>{e.actor}</td>
                <td>{e.action}</td>
                <td>{e.entity.slice(0, 12)}</td>
                <td>
                  <details>
                    <summary>View change</summary>
                    <pre style={{ whiteSpace: "pre-wrap", maxWidth: 400 }}>
                      Before: {e.oldValue}
                      {"\n"}After: {e.newValue}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
