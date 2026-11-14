import { AuthForm } from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default function Page() {
  return <AuthForm demo={process.env.PROBE_DEMO_ENABLED === "true"} />;
}
