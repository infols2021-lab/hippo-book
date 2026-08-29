"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useTour } from "@/components/tour/TourProvider";
import { saveTourProgress, clearTourProgress } from "@/lib/tour/tourPersistence";

export default function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { stage, advanceTour } = useTour();

  const tabs = useMemo(() => [
    {
      id: "materials",
      label: "Материалы",
      href: `/projects/${slug}/materials`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      )
    },
    {
      id: "rewards",
      label: "Награды",
      href: `/projects/${slug}/rewards`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"></circle>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
      )
    },
    {
      id: "requests",
      label: "Заявки",
      href: `/projects/${slug}/requests`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      id: "profile",
      label: "Профиль",
      href: `/projects/${slug}/profile`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    },
  ], [slug]);

  return (
    <nav
      className="md:hidden fixed left-4 right-4 z-[100] transition-all duration-300"
      style={{ bottom: "calc(16px + env(safe-area-inset-bottom))" }}
    >
      <div 
        className="flex items-center justify-between px-2 py-3 rounded-3xl"
        style={{
          backgroundColor: "color-mix(in srgb, var(--project-card-bg, #ffffff) 92%, transparent)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 12px 32px -4px rgba(0, 0, 0, 0.12)",
        }}
      >
        {tabs.map((tab) => {
          // Определяем активность таба. Если мы в профиле, горит профиль и т.д.
          const isActive = pathname?.startsWith(tab.href);

          const tourAttr =
            tab.id === "profile"
              ? "profile-link"
              : tab.id === "materials"
              ? "materials-link"
              : tab.id === "rewards"
              ? "rewards-btn"
              : tab.id === "requests"
              ? "requests-link"
              : undefined;

          const handleTour = () => {
            if (tab.id === "rewards" && stage === "rewards_gate") {
              clearTourProgress();
              saveTourProgress("rewards_tour", 0, window.location.pathname + `/rewards`);
              advanceTour("rewards_tour");
            } else if (tab.id === "materials" && stage === "materials_gate") {
              advanceTour("materials_demo");
            } else if (tab.id === "requests" && stage === "profile_requests_gate") {
              advanceTour("requests_info");
            }
          };

          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={true}
              data-tour={tourAttr}
              onClick={handleTour}
              className="flex flex-col items-center justify-center w-full gap-1 transition-colors duration-200 select-none"
              style={{
                color: isActive ? "var(--project-primary)" : "color-mix(in srgb, var(--project-text) 45%, transparent)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div 
                className={`transition-transform duration-300 ${isActive ? "scale-110" : "scale-100"}`}
                style={{
                  filter: isActive ? "drop-shadow(0 4px 6px color-mix(in srgb, var(--project-primary) 30%, transparent))" : "none"
                }}
              >
                {tab.icon}
              </div>
              <span className="text-[10px] font-bold tracking-wide mt-0.5">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}