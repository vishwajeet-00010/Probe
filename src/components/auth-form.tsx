"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { Brand, Field } from "./ui";
export function AuthForm({
  signup = false,
  reset = false,
}: {
  signup?: boolean;
  reset?: boolean;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  // Firebase keeps the session in the browser; /app resolves the organization.
  async function session(user: User) {
    if (!user.emailVerified) {
      await sendEmailVerification(user).catch(() => {});
      await signOut(clientAuth());
      throw new Error(
        "Verify your email first. We’ve sent you a fresh verification link.",
      );
    }
    router.push("/app/dashboard");
  }
  async function provider(type: "google" | "apple") {
    setBusy(true);
    setError("");
    try {
      const result = await signInWithPopup(
        clientAuth(),
        type === "google"
          ? new GoogleAuthProvider()
          : new OAuthProvider("apple.com"),
      );
      await session(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Brand />
        <div>
          <span className="eyebrow">LESS PAPER. MORE PEACE OF MIND.</span>
          <h2 style={{ margin: "20px 0" }}>
            Good food starts with good routines.
          </h2>
          <p className="muted" style={{ maxWidth: 360, fontSize: 16 }}>
            A simple home for your food-safety records, your team, and the
            little checks that matter.
          </p>
        </div>
        <small>Built for independent food businesses.</small>
      </aside>
      <main className="auth-main" id="main">
        <div className="auth-form">
          <h1>
            {reset
              ? "Reset your password"
              : signup
                ? "Start a better routine."
                : "Welcome back."}
          </h1>
          <p className="muted">
            {reset
              ? "We’ll send a reset link to your email."
              : signup
                ? "Your 14-day Pro trial starts here. No card required."
                : "A clear view of your business is one sign-in away."}
          </p>
          {error && (
            <p role="alert" className="error" style={{ marginTop: 18 }}>
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="notice" style={{ marginTop: 18 }}>
              {message}
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setMessage("");
              setBusy(true);
              const f = new FormData(e.currentTarget),
                email = String(f.get("email")),
                password = String(f.get("password"));
              try {
                const auth = clientAuth();
                if (reset) {
                  await sendPasswordResetEmail(auth, email);
                  setMessage(
                    "If this email has an account, a reset link will arrive shortly.",
                  );
                } else if (signup) {
                  const result = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password,
                  );
                  await sendEmailVerification(result.user);
                  router.push("/app/dashboard");
                } else {
                  const result = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password,
                  );
                  await session(result.user);
                }
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to continue.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email address">
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                placeholder="you@yourbusiness.com"
              />
            </Field>
            {!reset && (
              <Field label="Password">
                <input
                  type="password"
                  name="password"
                  minLength={signup ? 10 : 1}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                />
              </Field>
            )}
            {!signup && !reset && (
              <Link
                href="/forgot-password"
                style={{
                  fontSize: 12,
                  textAlign: "right",
                  color: "var(--green)",
                }}
              >
                Forgot password?
              </Link>
            )}
            <button className="btn primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : reset
                  ? "Send reset link"
                  : signup
                    ? "Create account"
                    : "Sign in"}
            </button>
          </form>
          {!reset && (
            <>
              <div className="divider">OR CONTINUE WITH</div>
              <div className="row">
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={busy}
                  onClick={() => provider("google")}
                >
                  Google
                </button>
                <button
                  className="btn"
                  style={{ flex: 1 }}
                  disabled={busy}
                  onClick={() => provider("apple")}
                >
                  Apple
                </button>
              </div>
            </>
          )}
          <p
            className="muted"
            style={{ marginTop: 25, textAlign: "center", fontSize: 13 }}
          >
            {signup ? "Already have an account?" : "New to Probe?"}{" "}
            <Link
              href={signup ? "/login" : "/signup"}
              style={{ color: "var(--green)", fontWeight: 600 }}
            >
              {signup ? "Sign in" : "Start free"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
