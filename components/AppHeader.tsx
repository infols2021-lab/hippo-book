import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import React from "react";

export type NavItem =
  | { kind: "link"; href: string; label: React.ReactNode; className?: string }
  | { kind: "logout"; label?: React.ReactNode; className?: string };

type Props = {
  markText?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  themeColor?: string; // Оставляем проп для легаси, но опираемся на CSS-переменные
  nav?: NavItem[];
};

export default function AppHeader({
  markText = "EK",
  title = "Образовательная платформа",
  subtitle = "Единая система тестирования",
  nav = [
    // Теперь по дефолту используются твои красивые классы из base.css
    { kind: "link", href: "/portal", label: "🏠 Портал", className: "btn ghost" },
    { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
  ],
}: Props) {
  return (
    <header
      className="sticky top-0 z-40 transition-colors duration-500"
      style={{
        // Эффект матового стекла, который адаптируется под цвет фона проекта
        backgroundColor: "color-mix(in srgb, var(--project-bg, #ffffff) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--project-border, rgba(0,0,0,0.08))",
        marginBottom: "24px",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* ЛОГОТИП И НАЗВАНИЕ */}
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl flex-shrink-0 transition-colors duration-500"
            style={{
              backgroundColor: "var(--project-primary, #3b82f6)",
              color: "#ffffff",
              border: "1px solid color-mix(in srgb, var(--project-primary) 50%, white)",
              boxShadow: "0 4px 14px 0 var(--project-glow, rgba(59, 130, 246, 0.4))",
            }}
          >
            {markText}
          </div>

          <div className="min-w-0">
            <h3
              className="text-lg sm:text-xl font-extrabold leading-tight truncate transition-colors duration-500"
              style={{ color: "var(--project-text, #111827)" }}
            >
              {title}
            </h3>
            <div
              className="text-xs sm:text-sm font-medium truncate mt-0.5 transition-colors duration-500"
              style={{ color: "var(--project-muted, #6b7280)" }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        {/* НАВИГАЦИЯ */}
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