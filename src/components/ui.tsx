"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, Clock3, TriangleAlert, X, Thermometer } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Probe home">
      <span className="brand-icon">
        <Thermometer size={25} />
      </span>
      probe<span style={{ color: "var(--green)", marginLeft: -5 }}>.</span>
    </Link>
  );
}
export function Badge({ status }: { status: string }) {
  const danger = [
      "High",
      "Out of range",
      "Failed",
      "Rejected",
      "Overdue",
      "Open",
    ].includes(status),
    amber = ["Medium", "Due", "In Progress", "Invited"].includes(status);
  return (
    <span className={`badge ${danger ? "red" : amber ? "amber" : ""}`}>
      {danger ? (
        <TriangleAlert size={11} />
      ) : amber ? (
        <Clock3 size={11} />
      ) : (
        <Check size={11} />
      )}{" "}
      {status}
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "drawer" : ""}
      onCancel={onClose}
      aria-labelledby="dialog-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-title">
        <h2 id="dialog-heading">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  text = "No records yet. Add your first record to get started.",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
