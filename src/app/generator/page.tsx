import { MarketingLayout } from "@/components/marketing";
export const metadata = { title: "Free printable food-safety log generator" };
export default function Page() {
  return (
    <MarketingLayout>
      <div className="prose">
        <h1>Your business. Your printable log.</h1>
        <p className="muted">
          Add your equipment and generate a clean PDF. No account or email
          needed.
        </p>
        <form
          action="/api/generator"
          className="card card-pad stack"
          style={{ marginTop: 30 }}
        >
          <label>
            Business name
            <input
              name="business"
              required
              maxLength={120}
              placeholder="Green Table Café"
            />
          </label>
          <label>
            Equipment or tasks — one per line
            <textarea
              name="equipment"
              required
              maxLength={1500}
              placeholder={"Walk-in fridge\nDisplay fridge\nMain freezer"}
            />
          </label>
          <button className="btn primary">Generate printable PDF</button>
        </form>
        <p className="muted">
          Set safe limits according to your own food-safety plan and local
          requirements.
        </p>
      </div>
    </MarketingLayout>
  );
}
