"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import { Plus } from "lucide-react";
import { Avatar, Badge } from "../ui";
import { ActionForm } from "../forms";
import { Heading } from "./heading";
export function Team() {
  const { state, site, actor, run } = useApp(),
    [invite, setInvite] = useState(false),
    [edit, setEdit] = useState<string | null>(null);
  const target = state.memberships.find((m) => m.id === edit);
  return (
    <>
      <Heading title="Team" description="The people behind every check.">
        <button className="btn primary" onClick={() => setInvite(true)}>
          <Plus size={16} />
          Invite team member
        </button>
      </Heading>
      <div className="notice" style={{ marginBottom: 20 }}>
        Probe doesn’t send invitation emails. Ask the person to sign up with the
        invited email address (web or the Probe app); after verifying it they
        can join your team.
      </div>
      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              {["Name", "Role", "Sites", "Status", "Last active", "Manage"].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {state.memberships.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="row">
                    <Avatar name={m.name} />
                    <div>
                      <strong>{m.name}</strong>
                      <p className="muted">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td>{m.role}</td>
                <td>
                  {m.siteIds
                    .map((id) => state.sites.find((s) => s.id === id)?.name)
                    .join(", ")}
                </td>
                <td>
                  <Badge status={m.status} />
                </td>
                <td>
                  {new Date(m.lastActive).toLocaleDateString("en-GB", {
                    timeZone: "UTC",
                  })}
                </td>
                <td>
                  {m.role !== "Owner" &&
                    (actor.role === "Owner" || m.role === "Staff") && (
                      <button className="btn" onClick={() => setEdit(m.id)}>
                        Manage
                      </button>
                    )}
                </td>
              </tr>
            ))}
            {state.invitations
              .filter((i) => i.status === "Invited")
              .map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="row">
                      <Avatar name={i.name} />
                      <div>
                        <strong>{i.name}</strong>
                        <p className="muted">{i.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{i.role}</td>
                  <td>
                    {i.siteIds
                      .map((id) => state.sites.find((s) => s.id === id)?.name)
                      .join(", ")}
                  </td>
                  <td>
                    <Badge status="Invited" />
                  </td>
                  <td>—</td>
                  <td>
                    {(actor.role === "Owner" || i.role === "Staff") && (
                      <button
                        className="btn danger"
                        onClick={() =>
                          run({ action: "team.revoke", id: i.id }).catch(
                            () => {},
                          )
                        }
                      >
                        Revoke invite
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      <div className="card card-pad" style={{ marginTop: 24 }}>
        <h2>Mobile devices & shared-device PIN</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          Device registration, PIN reset, revocation and sync health are planned
          for the mobile integration.
        </p>
      </div>
      {invite && (
        <ActionForm
          title="Create invitation"
          submitLabel="Save invitation"
          onClose={() => setInvite(false)}
          fields={[
            { name: "name", label: "Full name" },
            { name: "email", label: "Email", type: "email" },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: (actor.role === "Owner"
                ? ["Staff", "Manager"]
                : ["Staff"]
              ).map((v) => ({ value: v, label: v })),
            },
          ]}
          build={(v) => ({ action: "team.invite", ...v, siteIds: [site] })}
        />
      )}{" "}
      {target && (
        <ActionForm
          title={`Manage ${target.name}`}
          onClose={() => setEdit(null)}
          fields={[
            {
              name: "role",
              label: "Role",
              type: "select",
              value: target.role,
              options: (actor.role === "Owner"
                ? ["Staff", "Manager"]
                : ["Staff"]
              ).map((v) => ({ value: v, label: v })),
            },
            {
              name: "status",
              label: "Status",
              type: "select",
              value: target.status,
              options: ["Active", "Inactive"].map((v) => ({
                value: v,
                label: v,
              })),
            },
          ]}
          build={(v) => ({ action: "team.update", id: target.id, ...v })}
        />
      )}
    </>
  );
}
