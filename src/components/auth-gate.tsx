"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";
import {
  acceptInvitation,
  createOrganization,
  resolveSession,
  type Session,
} from "@/lib/data";
import type { Actor } from "@/types/domain";
import { Brand, Field } from "./ui";

/** Client-side gate for /app: Firebase Auth session -> organization membership. */
export function AuthGate({
  children,
}: {
  children: (actor: Actor) => React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | "loading">("loading");
  const configured = firebaseConfigured();
  const [error, setError] = useState(
    configured ? "" : "Firebase is not configured for this site.",
  );
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    async (user: User | null) => {
      if (!user) return router.replace("/login");
      try {
        setSession(await resolveSession(user));
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to load your account.",
        );
      }
    },
    [router],
  );
  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(clientAuth(), load);
  }, [configured, load]);
  const step = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const reload = async (user: User) => {
    await user.reload();
    await user.getIdToken(true);
    await load(clientAuth().currentUser);
  };
  if (error && session === "loading")
    return (
      <Panel title="We couldn’t open Probe">
        <p className="error">{error}</p>
      </Panel>
    );
  if (session === "loading")
    return (
      <Panel title="Opening your workspace…">
        <p className="muted">Checking your account.</p>
      </Panel>
    );
  if (session.status === "ready") {
    if (session.actor.role === "Staff")
      return (
        <Panel title="Your team account is ready">
          <p>
            Staff capture happens in the Probe mobile app. Sign in there with
            this email. Ask your manager if you need web access.
          </p>
          <SignOut />
        </Panel>
      );
    return <>{children(session.actor)}</>;
  }
  const { user } = session;
  if (session.status === "unverified")
    return (
      <Panel title="Verify your email">
        <p>
          We sent a verification link to <strong>{user.email}</strong>. Open it,
          then continue.
        </p>
        {error && <p className="error">{error}</p>}
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => step(() => reload(user))}
        >
          I’ve verified my email
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            step(async () => {
              await sendEmailVerification(user);
              setError("A new verification email is on its way.");
            })
          }
        >
          Resend email
        </button>
        <SignOut />
      </Panel>
    );
  if (session.status === "inactive")
    return (
      <Panel title="Your access is paused">
        <p>
          Your membership is inactive. Ask the business owner to restore it.
        </p>
        <SignOut />
      </Panel>
    );
  return (
    <Panel title="Set up your workspace">
      {error && <p className="error">{error}</p>}
      {session.invitations.length > 0 && (
        <section className="stack">
          <h2>You’ve been invited</h2>
          {session.invitations.map((invite) => (
            <div
              className="card card-pad row between"
              key={invite.organizationId}
            >
              <div>
                <strong>{invite.role}</strong>
                <p className="muted">Invited as {invite.name}</p>
              </div>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  step(async () => {
                    await acceptInvitation(user, invite);
                    await reload(user);
                  })
                }
              >
                Join team
              </button>
            </div>
          ))}
          <div className="divider">OR START YOUR OWN BUSINESS</div>
        </section>
      )}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name"));
          step(async () => {
            await createOrganization(user, name);
            await reload(user);
          });
        }}
      >
        <Field label="Business name">
          <input
            name="name"
            required
            maxLength={200}
            placeholder="Green Table Café"
          />
        </Field>
        <button className="btn primary" disabled={busy}>
          {busy ? "Creating…" : "Create my business"}
        </button>
        <p className="muted" style={{ fontSize: 12 }}>
          Your 14-day Pro trial starts now. No card required.
        </p>
      </form>
      <SignOut />
    </Panel>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="marketing-main">
      <Brand />
      <div className="stack" style={{ maxWidth: 520, marginTop: 40 }}>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <p style={{ marginTop: 20 }}>
      <Link
        href="/login"
        onClick={async (e) => {
          e.preventDefault();
          await signOut(clientAuth());
          router.replace("/login");
        }}
      >
        Sign out
      </Link>
    </p>
  );
}
