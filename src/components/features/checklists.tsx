"use client";
import { useState } from "react";
import { useApp } from "../app-provider";
import { Plus, FileText, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import type { Task } from "@/types/domain";
import { Empty, Field, Modal } from "../ui";
import { CaptureForm } from "../forms";
import { Heading } from "./heading";
export function Checklists() {
  const { state } = useApp(),
    [editing, setEditing] = useState<string | null>(null),
    [capture, setCapture] = useState(false);
  return (
    <>
      <Heading
        title="Checklists"
        description="Consistent routines, with a record of every version."
      >
        <button className="btn" onClick={() => setCapture(true)}>
          Log a check
        </button>
        <button className="btn primary" onClick={() => setEditing("")}>
          <Plus size={16} />
          Create template
        </button>
      </Heading>
      <div className="notice" style={{ marginBottom: 22 }}>
        Templates are versioned. Changes apply to future records; historical
        references stay unchanged.
      </div>
      <div className="template-grid">
        {state.templates.map((t) => {
          const v = state.templateVersions.find(
            (v) => v.id === t.currentVersionId,
          );
          return (
            <article className="card card-pad" key={t.id}>
              <div className="row between">
                <span className="metric-icon">
                  <FileText size={20} />
                </span>
                <span className="badge neutral">Version {v?.version}</span>
              </div>
              <h2 style={{ margin: "18px 0 6px" }}>{t.name}</h2>
              <p className="muted">
                {t.category} · {v?.tasks.length} tasks
              </p>
              <div className="equipment-footer row between">
                <small>{t.archived ? "Archived" : "Active template"}</small>
                <button className="btn" onClick={() => setEditing(t.id)}>
                  Edit template
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!state.templates.length && (
        <Empty text="Create your first checklist template to establish a repeatable routine." />
      )}
      {editing !== null && (
        <TemplateEditor id={editing} onClose={() => setEditing(null)} />
      )}{" "}
      {capture && <CaptureForm onClose={() => setCapture(false)} />}
    </>
  );
}
function TemplateEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, run, busy } = useApp();
  const template = state.templates.find((t) => t.id === id),
    version = state.templateVersions.find(
      (v) => v.id === template?.currentVersionId,
    );
  const [tasks, setTasks] = useState<Task[]>(
      version?.tasks ?? [
        {
          id: crypto.randomUUID(),
          label: "",
          type: "Checkbox",
          required: true,
          section: "General",
          correctivePrompt: "Record corrective action if this check fails.",
        },
      ],
    ),
    [error, setError] = useState(""),
    [drag, setDrag] = useState<number | null>(null);
  function move(from: number, to: number) {
    if (to < 0 || to >= tasks.length) return;
    const copy = [...tasks];
    const [task] = copy.splice(from, 1);
    copy.splice(to, 0, task);
    setTasks(copy);
  }
  return (
    <Modal
      title={id ? "Create a new template version" : "Create checklist template"}
      onClose={onClose}
    >
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          try {
            await run({
              action: "template.save",
              id: id || undefined,
              name: f.get("name"),
              category: f.get("category"),
              tasks,
            });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save.");
          }
        }}
      >
        <Field label="Template name">
          <input name="name" defaultValue={template?.name} required />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={template?.category}>
            {[
              "Opening",
              "Closing",
              "Cleaning",
              "Delivery",
              "Cooling",
              "Reheating",
              "Allergen checks",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {tasks.map((t, i) => (
          <div
            key={t.id}
            className="card card-pad stack gap-sm"
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (drag !== null) move(drag, i);
              setDrag(null);
            }}
          >
            <div className="row between">
              <span className="row">
                <GripVertical size={16} />
                Task {i + 1}
              </span>
              <span className="row">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move task ${i + 1} up`}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move task ${i + 1} down`}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={15} />
                </button>
              </span>
            </div>
            <Field label="Task instruction">
              <input
                value={t.label}
                required
                onChange={(e) =>
                  setTasks(
                    tasks.map((task, j) =>
                      j === i ? { ...task, label: e.target.value } : task,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Response type">
              <select
                value={t.type}
                onChange={(e) =>
                  setTasks(
                    tasks.map((task, j) =>
                      j === i
                        ? { ...task, type: e.target.value as Task["type"] }
                        : task,
                    ),
                  )
                }
              >
                {[
                  "Checkbox",
                  "Temperature",
                  "Number",
                  "Text",
                  "Required photo",
                  "Yes/No",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Section">
              <input
                value={t.section}
                onChange={(e) =>
                  setTasks(
                    tasks.map((task, j) =>
                      j === i ? { ...task, section: e.target.value } : task,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Corrective-action prompt">
              <input
                value={t.correctivePrompt}
                onChange={(e) =>
                  setTasks(
                    tasks.map((task, j) =>
                      j === i
                        ? { ...task, correctivePrompt: e.target.value }
                        : task,
                    ),
                  )
                }
              />
            </Field>
          </div>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() =>
            setTasks([
              ...tasks,
              {
                id: crypto.randomUUID(),
                label: "",
                type: "Checkbox",
                required: true,
                section: "General",
                correctivePrompt: "",
              },
            ])
          }
        >
          <Plus size={15} />
          Add task
        </button>
        <p className="muted">
          Typed task execution, required-photo uploads, and recurring scheduling
          workers are not activated yet.
        </p>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          Save template version
        </button>
      </form>
    </Modal>
  );
}
