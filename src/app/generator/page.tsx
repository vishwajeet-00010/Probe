import { MarketingLayout } from "@/components/marketing";
import { GeneratorForm } from "./generator-form";
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
        <GeneratorForm />
        <p className="muted">
          Set safe limits according to your own food-safety plan and local
          requirements.
        </p>
      </div>
    </MarketingLayout>
  );
}
