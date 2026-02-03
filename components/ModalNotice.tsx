"use client";

import { useEffect } from "react";

export type ModalKind = "success" | "error" | "warning";

export default function ModalNotice(props: {
  open: boolean;
  kind: ModalKind;
  title: string;
  message: string;
  primaryText?: string;
  onPrimary?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
  onClose: () => void;
}) {
  const {
    open,
    kind,
    title,
    message,
    primaryText,
    onPrimary,
    secondaryText,
    onSecondary,
    onClose,
  } = props;

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const icon = kind === "success" ? "✅" : kind === "error" ? "❌" : "⚠️";

  return (
    <div
      className="modal-notice-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={"modal-notice modal-" + kind}>
        <div className="modal-notice-head">
          <div className="modal-notice-icon" aria-hidden="true">
            {icon}
          </div>
          <div className="modal-notice-title">{title}</div>
          <button className="modal-notice-x" type="button" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="modal-notice-body" style={{ whiteSpace: "pre-line" }}>
          {message}
        </div>

        <div className="modal-notice-actions">
          {secondaryText ? (
            <button className="modal-notice-btn secondary" type="button" onClick={onSecondary || onClose}>
              {secondaryText}
            </button>
          ) : null}

          <button className="modal-notice-btn primary" type="button" onClick={onPrimary || onClose}>
            {primaryText || "Ок"}
          </button>
        </div>
      </div>
    </div>
  );
}
