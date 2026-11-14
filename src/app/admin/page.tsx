import { notFound } from "next/navigation";
import { getActor } from "@/lib/auth";
import { firebaseAdmin } from "@/lib/firebase/admin";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getActor().catch(() => null);
  if (!actor?.admin || actor.demo) notFound();
  const { q = "" } = await searchParams;
  const { db } = firebaseAdmin();
  const query = db
    .collection("organizations")
    .orderBy("name")
    .startAt(q)
    .endAt(`${q}\uf8ff`)
    .limit(25);
  const snapshot = await query.get();
  return (
    <main id="main" className="marketing-main">
      <h1>Probe internal administration</h1>
      <p className="muted">
        Metadata-only organization search. Operational record content is not
        included.
      </p>
      <form className="toolbar" style={{ marginTop: 25 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Business name prefix"
          aria-label="Search organizations"
        />
        <button className="btn">Search</button>
      </form>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Plan</th>
              <th>Trial ends</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.docs.map((d) => (
              <tr key={d.id}>
                <td>{String(d.get("name"))}</td>
                <td>{String(d.get("plan"))}</td>
                <td>{String(d.get("trialEndsAt"))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="notice" style={{ marginTop: 25 }}>
        Impersonation, trial overrides, feature flags and health aggregation are
        planned. No impersonation bypass is enabled.
      </div>
    </main>
  );
}
