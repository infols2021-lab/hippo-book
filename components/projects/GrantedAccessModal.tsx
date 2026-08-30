"use client";

import { useEffect, useState } from "react";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";

type GrantNotification = {
  id: string;
  material_title?: string | null;
  tab_title?: string | null;
  cover_url?: string | null;
};

export function notifyNewGrantForDirection() {
  window.dispatchEvent(new Event("hippo:grant-updated"));
}

export default function GrantedAccessModal({ projectSlug }: { projectSlug: string }) {
  const [current, setCurrent] = useState<GrantNotification | null>(null);

  const load = () => {
    fetch("/api/notifications/unread?project=" + encodeURIComponent(projectSlug), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const arr = Array.isArray(j?.notifications) ? j.notifications : [];
        setCurrent((prev) => prev ? prev : (arr.length ? arr[0] : null));
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    window.addEventListener("hippo:grant-updated", load);
    return () => window.removeEventListener("hippo:grant-updated", load);
  }, [projectSlug]);

  if (!current) return null;

  const cover = current.cover_url ? rewriteSupabasePublicStorageUrl(current.cover_url) : "";

  const dismiss = async () => {
    try { await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id }) }); } catch {}
    setCurrent(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 12000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box", backgroundColor: "rgba(15, 23, 42, 0.72)", backdropFilter: "blur(6px)" }}>
      <div style={{ width: "100%", maxWidth: 460, backgroundColor: "var(--project-card-bg, #ffffff)", color: "var(--project-text, #0f172a)", borderRadius: 24, padding: 24, textAlign: "center", boxShadow: "0 30px 70px rgba(0,0,0,0.35)" }}>
        {cover ? (
          <img src={cover} alt="" style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 16, margin: "0 auto 16px", display: "block", background: "#f1f5f9" }} />
        ) : (
          <div style={{ width: 180, height: 180, borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)", color: "var(--project-primary)" }}>
            {current.material_title ? current.material_title.charAt(0) : "M"}
          </div>
        )}
        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{"Вам выдан доступ"}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--project-primary, #0ea5e9)", marginBottom: 14 }}>{current.material_title || "Материал"}</div>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, marginBottom: 20, color: "color-mix(in srgb, var(--project-text) 70%, transparent)" }}>
          {"Чтобы пользоваться им, перейдите в раздел «Материалы» и выберите вкладку"}
          {current.tab_title ? <b>«{current.tab_title}»</b> : null}
        </div>
        <button type="button" onClick={dismiss} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: "var(--project-primary, #0ea5e9)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
          {"Понятно"}
        </button>
      </div>
    </div>
  );
}
