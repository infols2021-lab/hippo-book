"use client";

import React, { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number; // px
  /** если вдруг нужно запретить закрытие по клику на оверлей */
  closeOnOverlayClick?: boolean;
  /** если нужно запретить закрытие по ESC */
  closeOnEsc?: boolean;
};

function getScrollbarWidth() {
  // window.innerWidth включает scrollbar, documentElement.clientWidth — без него
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

  // ✅ lock scroll на body + компенсация ширины scrollbar, чтобы не было "дёргания"
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

  // ✅ ESC close
  useEffect(() => {
    if (!open || !closeOnEsc) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeOnEsc, onClose]);

  // ✅ автофокус в модалку (чтобы скролл колёсиком сразу работал внутри)
  useEffect(() => {
    if (!open) return;
    // маленькая задержка чтобы DOM точно был
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={(e) => {
        if (!closeOnOverlayClick) return;
        // закрываем только если кликнули именно по оверлею, не по панели
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        style={{ maxWidth }}
        tabIndex={-1}
        onMouseDown={(e) => {
          // чтобы клик внутри панели не "пробивал" закрытие
          e.stopPropagation();
        }}
      >
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon" aria-hidden="true">
              ✏️
            </div>
            <h3 className="modal-title" id={title ? titleId : undefined}>
              {title ?? ""}
            </h3>
          </div>

          <button className="modal-close" onClick={onClose} type="button" aria-label="Закрыть">
            ✕
          </button>
        </div>

        {/* ✅ ВАЖНО: скроллим не всю панель, а body внутри */}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
