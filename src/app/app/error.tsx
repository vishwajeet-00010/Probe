"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="content">
      <h1>We couldn’t load this workspace</h1>
      <p className="muted">
        Your records have not been changed. Please try again.
      </p>
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
