import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="marketing-main">
      <h1>This page isn’t here.</h1>
      <p className="muted" style={{ margin: "20px 0" }}>
        Check the link or return to Probe.
      </p>
      <Link className="btn primary" href="/">
        Back to home
      </Link>
    </main>
  );
}
