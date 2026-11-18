"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";
import { searchOrganizations } from "@/lib/data";
import type { Organization } from "@/types/domain";

/** Requires the internalAdmin custom claim (scripts/set-admin.mjs); rules enforce it. */
export function AdminSearch() {
  const configured = firebaseConfigured();
  const [allowed, setAllowed] = useState<boolean | null>(
      configured ? null : false,
    ),
    [rows, setRows] = useState<Organization[]>([]),
    [q, setQ] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(clientAuth(), async (user) => {
      const claims = user ? (await user.getIdTokenResult()).claims : {};
      setAllowed(claims.internalAdmin === true);
    });
  }, [configured]);
  if (allowed === null) return null;
  if (!allowed)
    return (
      <main id="main" className="marketing-main">
        <h1>Page not found</h1>
      </main>
    );
  return (
    <main id="main" className="marketing-main">
      <h1>Probe internal administration</h1>
      <p className="muted">
        Metadata-only organization search. Operational record content is not
        included.
      </p>
      <form
        className="toolbar"
        style={{ marginTop: 25 }}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setRows(await searchOrganizations(q));
            setError("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed.");
          }
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Business name prefix"
          aria-label="Search organizations"
        />
        <button className="btn">Search</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Created</th>
              <th>Trial ends</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.createdAt.slice(0, 10)}</td>
                <td>{o.trialEndsAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="notice" style={{ marginTop: 25 }}>
        Paid status lives in RevenueCat. Impersonation, trial overrides and
        feature flags are not available.
      </div>
    </main>
  );
}
