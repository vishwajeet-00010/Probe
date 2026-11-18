"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Actor, State } from "@/types/domain";
import { executeCommand, subscribeState } from "@/lib/data";
import { entitledPlan, type Plan } from "@/lib/billing";
type Context = {
  now: number;
  state: State;
  actor: Actor;
  site: string;
  setSite: (id: string) => void;
  search: string;
  setSearch: (q: string) => void;
  /** Runs a validated domain command as one atomic Firestore batch. */
  run: (command: unknown) => Promise<Record<string, string>>;
  /** Runs any async action with the shared busy state and toast messages. */
  act: <T>(fn: () => Promise<T>, success?: string) => Promise<T>;
  busy: boolean;
  toast: (s: string) => void;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State | null>(null),
    [plan, setPlan] = useState<Plan>("Free"),
    [error, setError] = useState(""),
    [site, setSite] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [now] = useState(() => Date.now()),
    latest = useRef<State | null>(null);
  useEffect(
    () =>
      subscribeState(
        actor,
        (s) => {
          latest.current = s;
          setState(s);
          setSite((current) => current || s.sites[0]?.id || "");
        },
        (e) => setError(e.message),
      ),
    [actor],
  );
  useEffect(() => {
    entitledPlan(actor.organizationId)
      .then(setPlan)
      .catch(() => setPlan("Free"));
  }, [actor.organizationId]);
  const toast = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(""), 6000);
  };
  async function act<T>(fn: () => Promise<T>, success = "Changes saved.") {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast(success);
      return result;
    } catch (e) {
      toast(friendly(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <main id="main" className="marketing-main">
        <h1>We couldn’t load this workspace</h1>
        <p className="muted">{error}</p>
      </main>
    );
  if (!state)
    return (
      <main id="main" className="marketing-main">
        <p className="muted">Loading your records…</p>
      </main>
    );
  // The stored plan is always "Free"; the RevenueCat entitlement is overlaid here.
  const view: State = {
    ...state,
    organization: { ...state.organization, plan },
  };
  return (
    <AppContext.Provider
      value={{
        now,
        state: view,
        actor,
        site,
        setSite,
        search,
        setSearch,
        run: (command) =>
          act(() =>
            executeCommand(
              actor,
              {
                ...(latest.current ?? state),
                organization: {
                  ...(latest.current ?? state).organization,
                  plan,
                },
              },
              command,
            ),
          ) as Promise<Record<string, string>>,
        act,
        busy,
        toast,
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </AppContext.Provider>
  );
}
function friendly(e: unknown) {
  const code = (e as { code?: string })?.code;
  if (code === "permission-denied")
    return "You do not have permission to perform this action.";
  if (code === "unavailable")
    return "You appear to be offline. Please try again.";
  return e instanceof Error ? e.message : "Unable to save changes.";
}
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("App provider required");
  return ctx;
}
