"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import React, { useState } from "react";
import RewardsModal from "@/components/rewards/RewardsModal";

export type NavItem =
  | { kind: "link"; href: string; label: React.ReactNode; className?: string }
  | { kind: "logout"; label?: React.ReactNode; className?: string }
  | { kind: "rewards"; label?: React.ReactNode; className?: string };

type Props = {
  markText?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  themeColor?: string;
  nav?: NavItem[];
};

export default function AppHeader({
  markText = "EK",
  title = "Образовательная платформа",
  subtitle = "Единая система тестирования",
  nav = [
    { kind: "link", href: "/portal", label: "🏠 Портал", className: "btn ghost" },
    { kind: "rewards", label: "🎭 Награды", className: "btn ghost" },
    { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
  ],
}: Props) {
  const [isRewardsOpen, setIsRewardsOpen] = useState(false);

  return (
    <>
      <header
        className="sticky top-0 z-40 transition-colors duration-500"
        style={{
          backgroundColor: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          borderBottom: "1px solid var(--glass-border)",
          boxShadow:
            "0 4px 20px -2px color-mix(in srgb, var(--project-text) 5%, transparent)",
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
                style={{
                  color:
                    "color-mix(in srgb, var(--project-text) 60%, transparent)",
                }}
              >
                {subtitle}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {nav.map((item, idx) => {
              if (item.kind === "link") {
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    className={`whitespace-nowrap flex-shrink-0 ${
                      item.className || "btn ghost"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              if (item.kind === "rewards") {
                return (
                  <button
                    key={`rewards-${idx}`}
                    onClick={() => setIsRewardsOpen(true)}
                    className={`whitespace-nowrap flex-shrink-0 ${
                      item.className || "btn ghost"
                    }`}
                  >
                    {item.label || "🎭 Награды"}
                  </button>
                );
              }

              return (
                <LogoutButton
                  key={`logout-${idx}`}
                  className={`whitespace-nowrap flex-shrink-0 ${
                    item.className || "btn secondary"
                  }`}
                >
                  {item.label || "🚪 Выйти"}
                </LogoutButton>
              );
            })}
          </div>
        </div>
      </header>

      {/* Единая модалка "Центр Наград" */}
      <RewardsModal
        isOpen={isRewardsOpen}
        onClose={() => setIsRewardsOpen(false)}
      />
    </>
  );
}