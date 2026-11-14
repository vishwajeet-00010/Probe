"use client";
import { useApp } from "../app-provider";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { Empty } from "../ui";
import { Heading } from "./heading";
export function Notifications() {
  const { state, actor, run } = useApp();
  return (
    <>
      <Heading
        title="Notifications"
        description="Stay close to what needs your attention."
      />
      <div className="card">
        {state.notifications.map((n) => (
          <div
            className="card-pad row between"
            key={n.id}
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div className="row">
              <Bell size={20} />
              <div>
                <h3>{n.title}</h3>
                <p className="muted">{n.body}</p>
                <small>
                  {new Date(n.createdAt).toLocaleString("en-GB", {
                    timeZone: "UTC",
                  })}
                </small>
              </div>
            </div>
            <div className="row">
              <Link className="btn" href={n.href}>
                View
              </Link>
              {!n.readBy.includes(actor.uid) && (
                <button
                  className="btn"
                  onClick={() =>
                    run({ action: "notification.read", id: n.id }).catch(
                      () => {},
                    )
                  }
                >
                  <Check size={14} />
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
        {!state.notifications.length && <Empty text="You’re all caught up." />}
      </div>
    </>
  );
}
