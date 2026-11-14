"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "../ui";
import { Heading } from "./heading";
const steps = [
  "Business information",
  "Business type",
  "Region pack",
  "Measurement units",
  "First site",
  "Opening hours",
  "Equipment",
  "Starter templates",
  "Invite staff",
  "Finish",
];
export function Onboarding() {
  const { state, run, busy } = useApp(),
    router = useRouter(),
    [step, setStep] = useState(Math.min(state.organization.onboardingStep, 9)),
    [error, setError] = useState("");
  const keys = [
    "name",
    "businessType",
    "region",
    "units",
    "siteName",
    "openingHours",
    "equipmentPlan",
    "templatePlan",
    "staffPlan",
    "confirmation",
  ];
  return (
    <>
      <Heading
        title="Let’s make Probe yours"
        description="A few details now. A clearer routine every day."
      />
      <div
        className="card card-pad stack"
        style={{ maxWidth: 700, margin: "auto" }}
      >
        <div className="row between">
          <h2>{steps[step]}</h2>
          <small>Step {step + 1} of 10</small>
        </div>
        <div className="progress">
          <span style={{ width: `${(step + 1) * 10}%` }} />
        </div>
        <form
          className="stack"
          key={step}
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await run({
                action: "onboarding.save",
                step: step + 1,
                values: Object.fromEntries(f),
              });
              if (step === 9) {
                router.push("/app/dashboard");
              } else setStep(step + 1);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to save setup.",
              );
            }
          }}
        >
          {step < 6 ? (
            <Field label={steps[step]}>
              {step === 3 ? (
                <select name="units" defaultValue={state.organization.units}>
                  <option value="C">Celsius</option>
                  <option value="F">Fahrenheit</option>
                </select>
              ) : step === 1 ? (
                <select name="businessType">
                  {[
                    "Café",
                    "Food truck",
                    "Bakery",
                    "Home food business",
                    "Takeaway",
                    "Multi-site operator",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={keys[step]}
                  defaultValue={
                    state.organization.onboarding[keys[step]] ??
                    (step === 0
                      ? state.organization.name
                      : step === 2
                        ? state.organization.region
                        : step === 4
                          ? state.sites[0]?.name
                          : "")
                  }
                  required
                />
              )}
            </Field>
          ) : step < 9 ? (
            <>
              <p className="muted">
                Your progress is saved. Use the dedicated page to configure this
                part of your workspace, then return to setup.
              </p>
              <Link
                className="btn"
                href={`/app/${step === 6 ? "equipment" : step === 7 ? "checklists" : "team"}`}
              >
                Open {steps[step].toLowerCase()} →
              </Link>
              <input name={keys[step]} type="hidden" value="Reviewed" />
            </>
          ) : (
            <>
              <h2>You’re ready to build your daily routine.</h2>
              <p className="muted">
                Review your equipment limits and team access before capturing
                real records.
              </p>
              <input name="confirmation" type="hidden" value="Complete" />
            </>
          )}
          {error && <p className="error">{error}</p>}
          <div className="row between">
            <button
              className="btn"
              type="button"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            <button className="btn primary" disabled={busy}>
              {step === 9 ? "Go to dashboard" : "Save & continue"}
            </button>
          </div>
        </form>
        <Link
          href="/app/dashboard"
          className="muted"
          style={{ fontSize: 12, textAlign: "center" }}
        >
          Save for later — you can resume anytime
        </Link>
      </div>
    </>
  );
}
