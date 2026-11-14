import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/auth";
import { readState, clientSnapshot } from "@/lib/database";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getActor().catch(() => null);
  if (!actor) redirect("/login");
  if (actor.role === "Staff")
    return (
      <main id="main" className="marketing-main">
        <h1>Your team account is ready</h1>
        <p>
          Staff capture is reserved for the mobile app. Ask your manager for
          access to the web control centre.
        </p>
        <Link href="/login">Back to sign in</Link>
      </main>
    );
  const state = await readState(actor);
  return (
    <AppProvider
      initial={clientSnapshot(state)}
      actor={actor}
      now={new Date().getTime()}
    >
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
