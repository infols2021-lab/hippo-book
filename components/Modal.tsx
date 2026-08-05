"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number; // px
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
};

function getScrollbarWidth() {
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = 760,
  closeOnOverlayClick = true,
  closeOnEsc = true,
}: Props) {
  const titleId = useId();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;

    const sbw = getScrollbarWidth();
    body.style.overflow = "hidden";
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || !mounted) return null;

  const modalContent = (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={(e) => {
        if (!closeOnOverlayClick) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal-panel w-full rounded-[28px] p-6 space-y-4 shadow-2xl relative border transition-all overflow-hidden flex flex-col"
        style={{
          maxWidth,
          maxHeight: "90vh",
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        }}
        tabIndex={-1}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          className="modal-header flex items-center justify-between pb-3 border-b flex-shrink-0"
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <div className="modal-title-wrap flex items-center gap-2.5 min-w-0 pr-2">
            <div className="modal-icon text-xl flex-shrink-0" aria-hidden="true">
              ✏️
            </div>
            <h3
              className="modal-title text-lg font-black tracking-tight truncate"
              id={title ? titleId : undefined}
              style={{ color: "var(--project-text, #0f172a)" }}
            >
              {title ?? ""}
            </h3>
          </div>

          <button
            className="modal-close w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-colors flex-shrink-0"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 8%, transparent)",
              color: "var(--project-text, #0f172a)",
            }}
            onClick={onClose}
            type="button"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="modal-body overflow-y-auto flex-1 pr-1">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}