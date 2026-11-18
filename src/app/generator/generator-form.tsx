"use client";
import { useEffect, useRef, useState } from "react";
import { printableLogPdf } from "@/lib/printable";

export function GeneratorForm() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    list = useRef<HTMLTextAreaElement>(null);
  // Template pages link here with ?equipment=… to prefill the list.
  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("equipment");
    if (preset && list.current) list.current.value = preset.slice(0, 1500);
  }, []);
  return (
    <form
      className="card card-pad stack"
      style={{ marginTop: 30 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          const f = new FormData(e.currentTarget);
          const bytes = await printableLogPdf(
            String(f.get("business")),
            String(f.get("equipment")),
          );
          const url = URL.createObjectURL(
            new Blob([bytes as BlobPart], { type: "application/pdf" }),
          );
          const a = Object.assign(document.createElement("a"), {
            href: url,
            download: "probe-food-safety-log.pdf",
          });
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Unable to generate.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Business name
        <input
          name="business"
          required
          maxLength={120}
          placeholder="Green Table Café"
        />
      </label>
      <label>
        Equipment or tasks — one per line
        <textarea
          name="equipment"
          required
          maxLength={1500}
          ref={list}
          placeholder={"Walk-in fridge\nDisplay fridge\nMain freezer"}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Generating…" : "Generate printable PDF"}
      </button>
    </form>
  );
}
