"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import Link from "next/link";
import { Check } from "lucide-react";
import { Field } from "../ui";
import { ActionForm } from "../forms";
import { Heading } from "./heading";
export function SettingsPage({ section = "business" }: { section?: string }) {
  const { state, actor, run, busy } = useApp(),
    [error, setError] = useState(""),
    [limits, setLimits] = useState<string | null>(null),
    [deleting, setDeleting] = useState(false);
  const org = state.organization,
    equipment = state.equipment.find((e) => e.id === limits);
  return (
    <>
      <Heading
        title="Settings"
        description="Make Probe work for your business."
      >
        <Link href="/app/audit" className="btn">
          View audit log
        </Link>
      </Heading>
      <nav className="tabs">
        {["Business", "Limits", "Notifications", "Billing"].map((t) => (
          <Link
            className={`tab ${section === t.toLowerCase() ? "active" : ""}`}
            href={`/app/settings/${t.toLowerCase()}`}
            key={t}
          >
            {t}
          </Link>
        ))}
      </nav>
      {section === "business" && (
        <div className="stack">
          <form
            className="card card-pad stack"
            style={{ maxWidth: 780 }}
            onSubmit={async (e) => {
              e.preventDefault();
              const values = Object.fromEntries(new FormData(e.currentTarget));
              try {
                await run({ action: "settings.save", ...values });
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to save.");
              }
            }}
          >
            <h2>Business details</h2>
            <div className="form-grid">
              {[
                { key: "name", label: "Business name" },
                { key: "address", label: "Address" },
                {
                  key: "registrationId",
                  label: "Food-business registration ID",
                },
                { key: "region", label: "Region pack" },
                { key: "timezone", label: "Timezone" },
              ].map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    name={f.key}
                    defaultValue={String(org[f.key as keyof typeof org])}
                    required={
                      f.key === "name" ||
                      f.key === "timezone" ||
                      f.key === "region"
                    }
                  />
                </Field>
              ))}
              <Field label="Preferred measurement unit">
                <select name="units" defaultValue={org.units}>
                  <option value="C">Celsius</option>
                  <option value="F">Fahrenheit (display preference)</option>
                </select>
              </Field>
            </div>
            <p className="muted">
              P0 temperature inputs and stored limits use °C. Confirm suitable
              limits for your operation and region; Probe does not certify legal
              compliance.
            </p>
            {error && <p className="error">{error}</p>}
            <button
              className="btn primary"
              disabled={busy || actor.role !== "Owner"}
            >
              Save business details
            </button>
          </form>
          <div className="card card-pad">
            <h2>Your data stays yours</h2>
            <p className="muted" style={{ margin: "10px 0" }}>
              Historical records and exports remain accessible after downgrade
              or cancellation.
            </p>
            <div className="row wrap">
              <a href="/api/export" download className="btn">
                Export all records
              </a>
              <Link href="/app/onboarding" className="btn">
                Resume setup
              </Link>
              {actor.demo && (
                <button
                  className="btn"
                  onClick={() => run({ action: "demo.clear" }).catch(() => {})}
                >
                  Remove sample activity
                </button>
              )}
              {actor.role === "Owner" && (
                <button
                  className="btn danger"
                  onClick={() => setDeleting(true)}
                >
                  Request account deletion
                </button>
              )}
            </div>
            {org.deletionRequestedAt && (
              <p className="notice" style={{ marginTop: 12 }}>
                Deletion requested on{" "}
                {new Date(org.deletionRequestedAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                })}
                . Final deletion worker is not activated; no data has been
                deleted.
              </p>
            )}
          </div>
        </div>
      )}
      {section === "limits" && (
        <div className="card">
          {state.equipment.map((e) => (
            <div
              key={e.id}
              className="card-pad row between"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <div>
                <h3>{e.name}</h3>
                <p className="muted">
                  {e.min} to {e.max} °C
                </p>
              </div>
              <button
                className="btn"
                disabled={actor.role !== "Owner"}
                onClick={() => setLimits(e.id)}
              >
                Change limits
              </button>
            </div>
          ))}
        </div>
      )}
      {section === "notifications" && (
        <form
          className="card card-pad stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await run({
                action: "notification.preferences",
                email: f.has("email"),
                push: f.has("push"),
                quietStart: f.get("quietStart"),
                quietEnd: f.get("quietEnd"),
              });
            } catch {}
          }}
        >
          <h2>Notification preferences</h2>
          <label className="check-label">
            <input
              type="checkbox"
              name="email"
              defaultChecked={
                state.notificationPreferences.find(
                  (p) => p.userId === actor.uid,
                )?.email
              }
            />
            Email alerts
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="push"
              defaultChecked={
                state.notificationPreferences.find(
                  (p) => p.userId === actor.uid,
                )?.push
              }
            />
            Mobile push
          </label>
          <div className="form-grid">
            <Field label="Quiet hours start">
              <input
                name="quietStart"
                type="time"
                defaultValue="22:00"
                required
              />
            </Field>
            <Field label="Quiet hours end">
              <input
                name="quietEnd"
                type="time"
                defaultValue="07:00"
                required
              />
            </Field>
          </div>
          <p className="muted">
            Preferences are saved. Email and mobile-push delivery adapters are
            not active.
          </p>
          <button className="btn primary" disabled={busy}>
            Save preferences
          </button>
        </form>
      )}
      {section === "billing" && <Billing />}
      {equipment && (
        <ActionForm
          title="Change temperature limits"
          onClose={() => setLimits(null)}
          fields={[
            {
              name: "min",
              label: "Safe minimum (°C)",
              type: "number",
              value: equipment.min,
            },
            {
              name: "max",
              label: "Safe maximum (°C)",
              type: "number",
              value: equipment.max,
            },
            {
              name: "reason",
              label: "Reason for changing limits",
              type: "textarea",
            },
          ]}
          build={(v) => ({
            action: "limits.update",
            id: equipment.id,
            min: Number(v.min),
            max: Number(v.max),
            reason: v.reason,
          })}
        />
      )}{" "}
      {deleting && (
        <ActionForm
          title="Request account deletion"
          submitLabel="Record deletion request"
          onClose={() => setDeleting(false)}
          fields={[
            {
              name: "confirmation",
              label:
                "Type DELETE to request deletion after a 30-day grace period",
            },
          ]}
          build={(v) => ({
            action: "account.delete-request",
            confirmation: v.confirmation,
          })}
        />
      )}
    </>
  );
}
function Billing() {
  const { state, actor, run, busy } = useApp();
  return (
    <div className="stack">
      <div className="notice">
        Current plan: {state.organization.plan}. Pro trial ends{" "}
        {new Date(state.organization.trialEndsAt).toLocaleDateString("en-GB", {
          timeZone: "UTC",
        })}
        . No credit card required.
      </div>
      <div className="feature-grid">
        {[
          {
            name: "Free",
            description: "Build your daily routine",
            features: [
              "1 site",
              "3 equipment",
              "2 users",
              "Sample inspection reports",
            ],
          },
          {
            name: "Pro",
            description: "For a growing food business",
            features: [
              "Per-site pricing",
              "Unlimited equipment & users",
              "Inspection packs",
              "Expiring share links",
            ],
          },
          {
            name: "Group",
            description: "A clear view across locations",
            features: [
              "3+ sites",
              "Multi-site architecture",
              "Shared operations",
              "Full historical export",
            ],
          },
        ].map((p) => (
          <div key={p.name} className="card card-pad stack">
            <h2>{p.name}</h2>
            <p className="muted">{p.description}</p>
            {p.features.map((f) => (
              <p className="row" key={f}>
                <Check size={14} />
                {f}
              </p>
            ))}
            {p.name !== "Free" && (
              <button
                className="btn primary"
                disabled={busy || actor.role !== "Owner"}
                onClick={async () => {
                  try {
                    const d = await run(
                      { action: "checkout", plan: p.name },
                      "/api/billing",
                    );
                    window.location.assign(d.url);
                  } catch {}
                }}
              >
                Choose {p.name}
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        className="btn"
        disabled={actor.role !== "Owner"}
        onClick={async () => {
          try {
            const d = await run({ action: "portal" }, "/api/billing");
            window.location.assign(d.url);
          } catch {}
        }}
      >
        Manage subscription & invoices
      </button>
      <p className="muted">
        Checkout requires configured Stripe prices. Historical records, reports
        and export are never locked on downgrade.
      </p>
    </div>
  );
}
