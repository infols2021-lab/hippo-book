"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useTour } from "@/components/tour/TourProvider";

export type NavItem =
  | { kind: "link"; href: string; label: React.ReactNode; className?: string; tourId?: string }
  | { kind: "logout"; label?: React.ReactNode; className?: string };

type Props = {
  markText?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  nav?: NavItem[];
};

export default function AppHeader({
  markText = "EK",
  title = "Образовательная платформа",
  subtitle = "Единая система тестирования",
  nav = [
    { kind: "link", href: "/portal", label: "🏠 Портал", className: "btn ghost" },
    { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
  ],
}: Props) {
  const { stage, advanceTour } = useTour();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    async function checkRole() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return;

        const supabase = createClient(url, key);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data } = await supabase
            .from("profiles")
            .select("role, is_admin")
            .eq("id", session.user.id)
            .single();

          if (data?.role === "teacher" || data?.is_admin === true) {
            setIsTeacher(true);
          }
        }
      } catch (err) {
        console.warn("Failed to check user role:", err);
      }
    }
    checkRole();
  }, []);

  const handleProfileNav = () => {
    if (stage === "requests_return_gate") advanceTour("materials_gate");
    if (stage === "materials_overview") advanceTour("rewards_gate");
  };

  return (
    <header
      className="sticky top-0 z-40 w-full transition-colors duration-500"
      style={{
        backgroundColor: "var(--glass-bg, transparent)",
        backdropFilter: "var(--glass-blur, blur(16px))",
        WebkitBackdropFilter: "var(--glass-blur, blur(16px))",
        borderBottom: "1px solid color-mix(in srgb, var(--project-text, #ffffff) 10%, transparent)",
        boxShadow: "0 4px 20px -2px color-mix(in srgb, var(--project-text, #ffffff) 5%, transparent)",
        marginBottom: "24px",
      }}
    >
      <div className="max-w-[1100px] w-[95%] mx-auto py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-[46px] h-[46px] flex items-center justify-center rounded-[14px] font-black text-lg flex-shrink-0 transition-all duration-500"
            style={{
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
              className="text-[17px] sm:text-[19px] font-extrabold leading-tight truncate transition-colors duration-500"
              style={{ color: "var(--project-text)" }}
            >
              {title}
            </h3>
            <div
              className="text-[12px] sm:text-[13px] font-medium truncate mt-0.5 transition-colors duration-500"
              style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {isTeacher && (
            <Link
              href="/teachers"
              className="whitespace-nowrap flex-shrink-0 btn ghost"
              style={{
                color: "var(--project-primary)",
                borderColor: "color-mix(in srgb, var(--project-primary) 30%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
              }}
            >
              👨‍🏫 Мои ученики
            </Link>
          )}

          {nav.map((item, idx) => {
            if (item.kind === "link") {
              const isProfileLink = item.tourId === "profile-link" || /\/profile\/?$/.test(item.href);
              return (
                <Link
                  key={`${item.href}-${idx}`}
                  href={item.href}
                  data-tour={isProfileLink ? "profile-link" : undefined}
                  onClick={isProfileLink ? handleProfileNav : undefined}
                  className={`whitespace-nowrap flex-shrink-0 ${item.className || "btn ghost"}`}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <LogoutButton
                key={`logout-${idx}`}
                className={`whitespace-nowrap flex-shrink-0 ${item.className || "btn secondary"}`}
              >
                {item.label || "🚪 Выйти"}
              </LogoutButton>
            );
          })}
        </div>
      </div>
    </header>
  );
}
