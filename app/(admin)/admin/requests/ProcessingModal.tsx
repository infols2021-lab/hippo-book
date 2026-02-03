"use client";

import Modal from "@/components/Modal";

type Props = {
  open: boolean;
  mode: "process" | "unprocess";
};

export default function ProcessingModal({ open, mode }: Props) {
  return (
    <Modal open={open} onClose={() => {}} maxWidth={420} title="">
      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            border: "4px solid #e5e7eb",
            borderTopColor: "var(--accent2)",
            margin: "0 auto 16px",
            animation: "processing_spin 1s linear infinite",
          }}
        />

        <h3 style={{ margin: "0 0 6px" }}>
          {mode === "process" ? "⏳ Заявки обрабатываются" : "↩️ Заявки возвращаются"}
        </h3>

        <div className="small-muted">
          Пожалуйста, подождите.<br />
          Не закрывайте страницу.
        </div>
      </div>

      <style>{`
        @keyframes processing_spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  );
}
