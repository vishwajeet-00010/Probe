"use client";
import { AuthGate } from "@/components/auth-gate";
import { AppProvider } from "@/components/app-provider";
import { Shell } from "@/components/shell";

/** Static-export friendly: authentication and data load in the browser. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {(actor) => (
        <AppProvider actor={actor}>
          <Shell>{children}</Shell>
        </AppProvider>
      )}
    </AuthGate>
  );
}
