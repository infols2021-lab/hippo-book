// components/projects/ProjectHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Modal from "@/components/Modal";
import { useTour } from "@/components/tour/TourProvider";
import {
  saveTourProgress,
  clearTourProgress,
} from "@/lib/tour/tourPersistence";

type Props = {
  slug: string;
  projectName: string;
  markText: string;
  /** Что отображается в левом блоке шапки (например, свитчер проектов). */
  left?: ReactNode;
  /** Подзаголовок страницы под названием проекта. */
  subtitle?: string;
};

export default function ProjectHeader({
  slug,
  projectName,
  markText,
  left,
  subtitle = "Ученик",
}: Props) {
  const pathname = usePathname();
  const { stage, advanceTour } = useTour();

  const [streak, setStreak] = useState<number | null>(null);
  const [doneToday, setDoneToday] = useState<boolean>(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const base = `/projects/${slug}`;

  // Активный таб по пути
  const isProfile = /\/profile\/?$/.test(pathname);
  const isMaterials = /\/materials\/?$/.test(pathname);
  const isRewards = /\/rewards\/?$/.test(pathname);
  const isRequests = /\/requests\/?$/.test(pathname);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/streaks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const curr =
          data.streak?.currentStreak ??
          data.currentStreak ??
          data.stats?.currentStreak ??
          0;
        const done =
          data.streak?.doneToday ??
          data.stats?.doneToday ??
          data.stats?.completedToday ??
          false;
        setStreak(Number(curr));
        setDoneToday(Boolean(done));
      })
      .catch(() => {/* ignore */});
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    setLogoutOpen(false);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } finally {
      window.location.href = "/login";
    }
  }

  function onRewards() {
    if (stage === "rewards_gate") {
      clearTourProgress();
      saveTourProgress("rewards_tour", 0, window.location.pathname + `/rewards`);
      advanceTour("rewards_tour");
    }
  }

  function onProfile() {
    if (stage === "materials_profile_gate") {
      advanceTour("rewards_gate");
    }
  }

  const pill = (active: boolean): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 14,
    fontWeight: 800,
    fontSize: 13,
    color: active ? "#ffffff" : "var(--project-text)",
    background: active
      ? "var(--project-primary)"
      : "color-mix(in srgb, var(--project-text) 6%, transparent)",
    border: "1px solid var(--glass-border, rgba(15,23,42,0.08))",
    transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <header
      className="hidden md:flex items-center justify-between gap-6 mb-8"
      style={{
        background:
          "var(--glass-bg, color-mix(in srgb, var(--project-card-bg) 92%, transparent))",
        backdropFilter: "var(--glass-blur, blur(16px))",
        WebkitBackdropFilter: "var(--glass-blur, blur(16px))",
        border: "1px solid var(--glass-border, rgba(15,23,42,0.08))",
        boxShadow: "var(--glass-shadow, 0 12px 30px -12px rgba(15, 23, 42, 0.15))",
        borderRadius: 28,
        padding: "14px 24px",
      }}
    >
      {/* Левая часть: либо слот (свитчер профиля), либо марка + название */}
      {left ? (
        <div className="flex items-center gap-5 flex-1 min-w-0">{left}</div>
      ) : (
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="flex items-center justify-center rounded-[14px] font-black text-lg flex-shrink-0"
            style={{
              width: 46,
              height: 46,
              background: "var(--project-primary)",
              color: "#ffffff",
              boxShadow:
                "inset 0 1px 1px rgba(255,255,255,0.3), 0 8px 16px -4px color-mix(in srgb, var(--project-primary) 50%, transparent)",
            }}
          >
            {markText}
          </div>
          <div className="min-w-0">
            <h3
              className="text-[19px] font-extrabold leading-tight truncate"
              style={{ color: "var(--project-text)" }}
            >
              {projectName}
            </h3>
            <div
              className="text-[13px] font-medium truncate mt-0.5"
              style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}
            >
              {subtitle}
            </div>
          </div>
        </div>
      )}

      {/* Правая часть: стрик + навигация + помощь + выход */}
      <div className="flex items-center gap-3 flex-wrap" style={{ justifyContent: "flex-end" }}>
        {/* Огонёк серии (как на ПК) */}
        <div
          style={{
            height: 44,
            borderRadius: 14,
            padding: "6px 14px",
            display: "grid",
            gridTemplateColumns: "28px auto",
            gridTemplateRows: "1fr 1fr",
            columnGap: 10,
            alignItems: "center",
            background:
              "linear-gradient(135deg, color-mix(in srgb, #f59e0b 14%, var(--project-card-bg)), color-mix(in srgb, #f97316 8%, var(--project-card-bg)))",
            border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
            boxShadow: "0 6px 18px -8px color-mix(in srgb, #f59e0b 45%, transparent)",
          }}
        >
          <div
            style={{
              gridRow: "1 / span 2",
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              color: "#ffffff",
              background: "linear-gradient(145deg, #f59e0b, #ea580c)",
              boxShadow: "0 4px 12px -4px rgba(234,88,12,0.5)",
              overflow: "hidden",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 900, color: "var(--project-text)", lineHeight: 1 }}>
            {streak ?? "…"}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}>
            {doneToday ? "сделано" : "серия"}
          </span>
        </div>

        <Link href={`${base}/profile`} style={pill(isProfile)} data-tour="profile-link" onClick={() => onProfile()}>
          Профиль
        </Link>
        <Link
          href={`${base}/materials`}
          style={pill(isMaterials)}
          data-tour="materials-link"
          onClick={() => {
            if (stage === "materials_gate") advanceTour("materials_demo");
          }}
        >
          Материалы
        </Link>
        <Link
          href={`${base}/rewards`}
          style={pill(isRewards)}
          data-tour="rewards-btn"
          onClick={() => onRewards()}
        >
          Награды
        </Link>
        <Link
          href={`${base}/requests`}
          style={pill(isRequests)}
          data-tour="requests-link"
          onClick={() => {
            if (stage === "profile_requests_gate") advanceTour("requests_info");
          }}
        >
          Заявки
        </Link>

        <button
          type="button"
          aria-label="Помощь по платформе"
          title="Помощь по платформе"
          onClick={() => window.dispatchEvent(new Event("start-product-tour"))}
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            border: "1px solid var(--glass-border)",
            background: "color-mix(in srgb, var(--project-text) 6%, transparent)",
            color: "var(--project-text)",
            fontSize: 16,
            fontWeight: 900,
            lineHeight: 1,
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          ?
        </button>

        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          aria-label="Выйти из аккаунта"
          title="Выйти из аккаунта"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 14,
            fontWeight: 800,
            fontSize: 13,
            color: "#ef4444",
            background: "color-mix(in srgb, #ef4444 10%, transparent)",
            border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Выйти
        </button>
      </div>

      <Modal open={logoutOpen} onClose={() => setLogoutOpen(false)} title="Выход из аккаунта" maxWidth={420}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)",
              color: "#ef4444",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </div>
          <p style={{ margin: "0 0 24px", fontWeight: 700, fontSize: 16, lineHeight: 1.45, color: "var(--project-text)" }}>
            Вы уверены, что хотите выйти из аккаунта?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              type="button"
              onClick={() => void logout()}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#ef4444", color: "#fff", fontWeight: 900, fontSize: 14, border: "none", cursor: "pointer" }}
            >
              Да, выйти
            </button>
            <button
              type="button"
              onClick={() => setLogoutOpen(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "color-mix(in srgb, var(--project-text) 6%, transparent)", color: "var(--project-text)", fontWeight: 800, fontSize: 14, border: "1px solid var(--glass-border)", cursor: "pointer" }}
            >
              Нет, остаться
            </button>
          </div>
        </div>
      </Modal>
    </header>
  );
}
