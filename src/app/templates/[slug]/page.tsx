import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingLayout } from "@/components/marketing";
import { publicTemplates } from "@/lib/public-templates";
export function generateStaticParams() {
  return publicTemplates.map((t) => ({ slug: t.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = publicTemplates.find((t) => t.slug === slug);
  return { title: t?.title, description: t?.description };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    t = publicTemplates.find((t) => t.slug === slug);
  if (!t) notFound();
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Do I need an account?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Printable templates are free and do not require signup.",
        },
      },
      {
        "@type": "Question",
        name: "Does this guarantee compliance?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Adapt the record to your food-safety plan and local requirements.",
        },
      },
    ],
  };
  return (
    <MarketingLayout>
      <article className="prose">
        <h1>{t.title}</h1>
        <p>{t.description}</p>
        <p>{t.use}</p>
        <div className="card table-wrap" style={{ margin: "25px 0" }}>
          <table>
            <thead>
              <tr>
                {[
                  "Date",
                  "Time",
                  "Unit / task",
                  "Reading / result",
                  "Initials",
                  "Action",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6].map((c) => (
                    <td key={c} style={{ height: 45 }}>
                      {" "}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <a
          className="btn primary"
          href={`/generator?equipment=${encodeURIComponent(t.title)}`}
        >
          Create printable PDF
        </a>{" "}
        <Link className="btn" href="/generator">
          Customise your log
        </Link>
        <h2>Do I need an account?</h2>
        <p>
          No. Downloads are free without signup. We do not collect your email.
        </p>
        <h2>Does this guarantee compliance?</h2>
        <p>
          No. Adapt the record to your food-safety plan and local requirements.
        </p>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faq).replace(/</g, "\\u003c"),
        }}
      />
    </MarketingLayout>
  );
}
