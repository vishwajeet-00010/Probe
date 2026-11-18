"use client";
import { useEffect, useState } from "react";
import { inspectReport } from "@/lib/data";
import { firebaseConfigured } from "@/lib/firebase/client";
import { Brand, Badge } from "@/components/ui";
import type { Report } from "@/types/domain";

export function InspectView() {
  const [report, setReport] = useState<Report | null | "loading">("loading");
  useEffect(() => {
    const token = firebaseConfigured() ? window.location.hash.slice(1) : "";
    inspectReport(token).then(setReport);
  }, []);
  if (report === "loading")
    return (
      <main className="marketing-main" id="main">
        <Brand />
        <p className="muted" style={{ marginTop: 40 }}>
          Loading inspection report…
        </p>
      </main>
    );
  if (!report)
    return (
      <main className="marketing-main" id="main">
        <Brand />
        <h1 style={{ margin: "40px 0 15px" }}>
          This inspection link is unavailable.
        </h1>
        <p>
          It may have expired or been revoked. Ask the business for a new link.
        </p>
      </main>
    );
  return (
    <main className="marketing-main" id="main" style={{ paddingTop: 30 }}>
      <div className="row between">
        <Brand />
        <span className="badge">READ-ONLY INSPECTION VIEW</span>
      </div>
      <article className="report-preview" style={{ marginTop: 30 }}>
        {report.watermarked && (
          <p className="notice">Sample report · Free plan</p>
        )}
        <span className="eyebrow">INSPECTION PACK</span>
        <h1 style={{ margin: "15px 0" }}>{report.businessName}</h1>
        <p>{report.address}</p>
        <p>
          Period: {report.start} — {report.end}
        </p>
        <p className="muted">
          Generated{" "}
          {new Date(report.generatedAt).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC by {report.generatedBy}
        </p>
        <p className="muted">Report ID: {report.id}</p>
        <div className="row" style={{ margin: "25px 0" }}>
          <span className="badge">{report.entries.length} records</span>
          <span className="badge">{report.issues.length} issues</span>
        </div>
        <h2>Recorded checks</h2>
        <div className="table-wrap" style={{ marginTop: 15 }}>
          <table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Check</th>
                <th>Original value</th>
                <th>Status</th>
                <th>Staff / notes / amendments</th>
              </tr>
            </thead>
            <tbody>
              {report.entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.serverTimestamp.slice(0, 16).replace("T", " ")}</td>
                  <td>{e.label}</td>
                  <td>{e.value}</td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 200 }}>
                    {e.staff}
                    <p className="muted">{e.notes}</p>
                    {e.amendments.map((a) => (
                      <p key={a.id}>
                        Amended: {a.value} — {a.reason} ({a.actor})
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 style={{ margin: "30px 0 15px" }}>Issues & corrective actions</h2>
        {report.issues.map((i) => (
          <section
            key={i.id}
            className="card card-pad"
            style={{ marginBottom: 15 }}
          >
            <h3>
              {i.title} — {i.status}
            </h3>
            {i.timeline.map((t, n) => (
              <p key={n} className="muted">
                {t.actor}: {t.note}
              </p>
            ))}
          </section>
        ))}
        <p style={{ marginTop: 30 }}>
          Signed: ___________________________ Date: ________________
        </p>
        <p className="muted" style={{ marginTop: 25, fontSize: 12 }}>
          This report presents operational records. It is not a legal compliance
          certificate. Use your browser’s print command to print this page.
        </p>
      </article>
    </main>
  );
}
