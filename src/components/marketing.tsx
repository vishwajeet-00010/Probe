import Link from "next/link";
import {
  Check,
  ArrowRight,
  Thermometer,
  ClipboardCheck,
  FileCheck2,
} from "lucide-react";
import { Brand } from "./ui";
export function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="marketing-nav">
        <Brand />
        <nav className="row nav-desktop" style={{ gap: 30, fontSize: 13 }}>
          <Link href="/features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/templates">Free templates</Link>
          <Link href="/guides">Guides</Link>
        </nav>
        <div className="row">
          <Link className="btn" href="/login">
            Sign in
          </Link>
          <Link className="btn primary" href="/signup">
            Start free <ArrowRight size={14} />
          </Link>
        </div>
      </header>
      <main id="main" className="marketing-main">
        {children}
      </main>
      <footer className="footer">
        <span>
          © {new Date().getFullYear()} Probe. Good routines, good records.
        </span>
        <nav className="row wrap">
          {["About", "Contact", "Terms", "Privacy"].map((t) => (
            <Link key={t} href={`/${t.toLowerCase()}`}>
              {t}
            </Link>
          ))}
          <Link href="/generator">Free log generator</Link>
        </nav>
      </footer>
    </>
  );
}
export function MarketingHome() {
  return (
    <MarketingLayout>
      <section className="hero">
        <div>
          <span className="badge">FOOD SAFETY, IN GOOD HANDS</span>
          <h1>
            Less paperwork.
            <br />
            More peace
            <br />
            of mind.
          </h1>
          <p>
            Keep your food-safety checks, your team, and your inspection records
            in one calm, organised place.
          </p>
          <div className="row">
            <Link className="btn primary" href="/signup">
              Start free <ArrowRight size={15} />
            </Link>
            <Link className="btn" href="/login">
              See how it works
            </Link>
          </div>
          <small className="row">
            <Check size={13} />
            No card required · 14-day Pro trial
          </small>
        </div>
        <div className="hero-visual">
          <div className="card">
            <div className="row between">
              <h3>Green Table Café</h3>
              <span className="badge">DEMO</span>
            </div>
            <h2 style={{ fontSize: 26, margin: "28px 0 6px" }}>
              A good day starts here.
            </h2>
            <p style={{ fontSize: 12 }}>Your daily routine, all together.</p>
            <div className="row between" style={{ margin: "26px 0" }}>
              <span style={{ fontSize: 36, fontWeight: 600 }}>
                9 <small>of 12 checks</small>
              </span>
              <span className="badge">75% done</span>
            </div>
            <div className="progress">
              <span style={{ width: "75%" }} />
            </div>
            {[
              "Opening checklist",
              "Walk-in fridge temperature",
              "Allergen information",
            ].map((t) => (
              <div
                className="row between"
                style={{
                  padding: "17px 0",
                  borderBottom: "1px solid var(--line)",
                  fontSize: 12,
                }}
                key={t}
              >
                <span>{t}</span>
                <Check size={15} color="#215c42" />
              </div>
            ))}
            <p className="muted" style={{ fontSize: 10, marginTop: 18 }}>
              Illustrative workspace · not a compliance score
            </p>
          </div>
        </div>
      </section>
      <section className="marketing-section">
        <span className="eyebrow">BUILT FOR YOUR EVERYDAY</span>
        <h2>Small checks. A clearer picture.</h2>
        <div className="feature-grid">
          {[
            {
              icon: Thermometer,
              title: "Catch the things that matter",
              text: "Track temperatures, spot excursions and keep corrective actions connected to the original record.",
            },
            {
              icon: ClipboardCheck,
              title: "A routine your team can follow",
              text: "Organise opening, closing and cleaning checks with versioned templates and clear responsibilities.",
            },
            {
              icon: FileCheck2,
              title: "Records ready for review",
              text: "Turn your daily records into dated inspection packs. Share a controlled, read-only snapshot.",
            },
          ].map((f) => (
            <div className="card" key={f.title}>
              <f.icon size={25} />
              <h2 style={{ fontSize: 19, margin: "20px 0 10px" }}>{f.title}</h2>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section
        className="card card-pad"
        style={{
          textAlign: "center",
          padding: "48px 24px",
          background: "var(--pale)",
        }}
      >
        <h2 style={{ fontSize: 30 }}>
          For the businesses that feed our neighbourhoods.
        </h2>
        <p className="muted" style={{ margin: "16px 0 24px" }}>
          Cafés · Food trucks · Bakeries · Home kitchens · Independent takeaways
        </p>
        <Link href="/signup" className="btn primary">
          Make room for a better routine <ArrowRight size={15} />
        </Link>
      </section>
    </MarketingLayout>
  );
}
