"use client";
import { createContext, useContext, useState } from "react";
import type { Actor, State } from "@/types/domain";
type Context = {
  now: number;
  state: State;
  actor: Actor;
  site: string;
  setSite: (id: string) => void;
  search: string;
  setSearch: (q: string) => void;
  run: (
    body: unknown,
    path?: string,
    method?: string,
  ) => Promise<Record<string, string>>;
  refresh: () => Promise<void>;
  busy: boolean;
  toast: (s: string) => void;
};
const AppContext = createContext<Context | null>(null);
export function AppProvider({
  initial,
  actor,
  children,
  now,
}: {
  initial: State;
  actor: Actor;
  children: React.ReactNode;
  now: number;
}) {
  const [state, setState] = useState(initial),
    [site, setSite] = useState(initial.sites[0]?.id ?? ""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const toast = (s: string) => {
    setMessage(s);
    setTimeout(() => setMessage(""), 6000);
  };
  async function refresh() {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("Unable to refresh records. Please reload.");
    setState(await res.json());
  }
  async function run(body: unknown, path = "/api/commands", method = "POST") {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to save changes.");
      await refresh();
      toast("Changes saved.");
      return data;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to save changes.");
      throw e;
    } finally {
      setBusy(false);
    }
  }
  return (
    <AppContext.Provider
      value={{
        now,
        state,
        actor,
        site,
        setSite,
        search,
        setSearch,
        run,
        refresh,
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
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("App provider required");
  return ctx;
}
