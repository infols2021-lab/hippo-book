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
  themeColor?: string; // Позволяет прокинуть цвет ветки (например, "var(--project-primary)")
  nav?: NavItem[];
};

export default function AppHeader({
  markText = "EK",
  title = "Образовательная платформа",
  subtitle = "Единая система тестирования",
  themeColor = "#3b82f6", // Дефолтный синий
  nav = [
    { kind: "link", href: "/portal", label: "🏠 Портал", className: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
    { kind: "logout", label: "🚪 Выйти", className: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50" },
  ],
}: Props) {
  return (
    <header className="bg-white border-b sticky top-0 z-40 shadow-sm transition-colors duration-500">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* ЛОГОТИП И НАЗВАНИЕ */}
        <div className="flex items-center gap-4">
          <div 
            className="w-12 h-12 flex items-center justify-center rounded-2xl font-black text-white text-xl shadow-md border border-white/20 flex-shrink-0"
            style={{ 
              backgroundColor: themeColor,
              boxShadow: `0 4px 14px 0 ${themeColor}40` // Динамическая тень в цвет темы
            }}
          >
            {markText}
          </div>

          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight truncate">
              {title}
            </h3>
            <div className="text-xs sm:text-sm text-gray-500 font-medium truncate mt-0.5">
              {subtitle}
            </div>
          </div>
        </div>

        {/* НАВИГАЦИЯ */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          {nav.map((item, idx) => {
            if (item.kind === "link") {
              return (
                <Link 
                  key={`${item.href}-${idx}`} 
                  href={item.href}
                  className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap text-sm flex-shrink-0 ${item.className || ""}`}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <LogoutButton 
                key={`logout-${idx}`} 
                className={`px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap text-sm flex-shrink-0 ${item.className || ""}`}
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