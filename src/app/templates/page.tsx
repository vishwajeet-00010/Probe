import Link from "next/link";
import { MarketingLayout } from "@/components/marketing";
import { publicTemplates } from "@/lib/public-templates";
export const metadata = { title: "Free food-safety log templates" };
export default function Page() {
  return (
    <MarketingLayout>
      <h1>Less blank paper. More useful records.</h1>
      <p className="muted" style={{ margin: "15px 0 35px" }}>
        Free printable templates. No signup, no email required.
      </p>
      <div className="feature-grid">
        {publicTemplates.map((t) => (
          <article key={t.slug} className="card">
            <h2>{t.title}</h2>
            <p>{t.description}</p>
            <Link
              href={`/templates/${t.slug}`}
              className="btn"
              style={{ marginTop: 22 }}
            >
              Preview & download →
            </Link>
          </article>
        ))}
      </div>
    </MarketingLayout>
  );
}
