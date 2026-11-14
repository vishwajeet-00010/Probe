import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing";
const content: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  features: {
    title: "A clearer way to run your routine.",
    intro:
      "From the first temperature check to the final inspection pack, Probe keeps the record together.",
    sections: [
      [
        "Capture and review",
        "Temperature records, cleaning checks, deliveries and corrective actions sit in one searchable log. Original entries stay visible when managers add amendments.",
      ],
      [
        "Respond with evidence",
        "Out-of-range readings create issues. Record the action taken, then verify high-severity resolutions.",
      ],
      [
        "Prepare for inspection",
        "Generate a dated PDF snapshot and create an expiring, revocable, read-only inspector link.",
      ],
    ],
  },
  guides: {
    title: "Make your daily checks easier.",
    intro:
      "Practical ways to organise records. Your food-safety plan and local authority determine the checks and limits you need.",
    sections: [
      [
        "Start with your equipment",
        "Give each fridge, freezer and hot-hold unit a clear name and location. Set limits appropriate to your process.",
      ],
      [
        "Make ownership clear",
        "Assign checks to people or roles. Review overdue tasks at the beginning and end of a shift.",
      ],
      [
        "Record the response",
        "If a check fails, record what happened and the corrective action. Preserve the original reading, even when it was entered incorrectly.",
      ],
    ],
  },
  about: {
    title: "Good routines deserve good tools.",
    intro:
      "Probe is being built for independent food businesses that need reliable records without unnecessary administration.",
    sections: [
      [
        "A calm control centre",
        "The web app helps managers review daily work, address issues and prepare records for inspection. Mobile capture is a separate planned integration.",
      ],
      [
        "Records you can trust",
        "Original entries remain visible. Corrections need reasons. Access is scoped to the organization and role.",
      ],
    ],
  },
  contact: {
    title: "Let’s keep things clear.",
    intro: "This is a development preview of Probe.",
    sections: [
      [
        "Getting in touch",
        "A public support inbox has not been configured. Contact the operator who provided this installation for setup or support.",
      ],
      [
        "Need a printable log?",
        "Use our free log generator. It does not require an account or an email address.",
      ],
    ],
  },
  terms: {
    title: "Terms — draft for operator review",
    intro:
      "These development-preview terms are not a finalized service agreement.",
    sections: [
      [
        "Food-safety responsibility",
        "Probe helps record operational activity. It does not guarantee legal compliance or replace a business’s food-safety plan, qualified advice or inspections.",
      ],
      [
        "Availability and accounts",
        "Production service commitments, operator identity, pricing, jurisdiction and cancellation terms must be supplied before public launch. Do not use this preview as your sole record system.",
      ],
      [
        "Your records",
        "The intended product policy preserves historical access and full export after cancellation or downgrade.",
      ],
    ],
  },
  privacy: {
    title: "Privacy — draft for operator review",
    intro:
      "This preview stores business details, team information and operational records in the configured backend.",
    sections: [
      [
        "Local demonstration",
        "Demo workspaces contain synthetic data and use a signed session cookie. Local demo records are stored on the server until removed by its operator.",
      ],
      [
        "Production data",
        "Firebase authentication and database services and Stripe billing require an operator-owned configuration. Email, analytics and error tracking adapters have not been activated.",
      ],
      [
        "Before launch",
        "The operator must supply controller contact details, processing purposes, lawful bases, retention periods, subprocessor disclosures and rights-request procedures.",
      ],
    ],
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const { page } = await params;
  return { title: content[page]?.title ?? "Pricing" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (page === "pricing")
    return (
      <MarketingLayout>
        <div style={{ textAlign: "center", marginBottom: 45 }}>
          <span className="eyebrow">ROOM FOR YOUR ROUTINE TO GROW</span>
          <h1 style={{ fontSize: 44, margin: "15px 0" }}>
            Simple plans. Your records stay yours.
          </h1>
          <p className="muted">
            Start with a 14-day Pro trial. No card required.
          </p>
        </div>
        <div className="feature-grid">
          {[
            [
              "Free",
              "For getting started",
              "1 site · 3 equipment · 2 users",
              "Basic alerts and watermarked reports",
            ],
            [
              "Pro",
              "For everyday operations",
              "Per-site pricing · Unlimited users & equipment",
              "Inspection packs and expiring share links",
            ],
            [
              "Group",
              "For multiple locations",
              "3+ sites · Multi-site architecture",
              "Shared operations and full export",
            ],
          ].map(([name, tag, features, more]) => (
            <section className="card stack" key={name}>
              <h2 style={{ fontSize: 26 }}>{name}</h2>
              <p className="muted">{tag}</p>
              <h3>
                {name === "Free" ? "Free" : "Pricing configured by operator"}
              </h3>
              <p>{features}</p>
              <p>{more}</p>
              <Link className="btn primary" href="/signup">
                Start free
              </Link>
            </section>
          ))}
        </div>
        <p className="notice" style={{ marginTop: 30 }}>
          Historical records, reports and full export remain accessible when you
          downgrade or cancel.
        </p>
      </MarketingLayout>
    );
  const data = content[page];
  if (!data) notFound();
  return (
    <MarketingLayout>
      <article className="prose">
        <h1>{data.title}</h1>
        <p className="muted">{data.intro}</p>
        {data.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <Link href="/generator" className="btn" style={{ marginTop: 24 }}>
          Try the free log generator →
        </Link>
      </article>
    </MarketingLayout>
  );
}
