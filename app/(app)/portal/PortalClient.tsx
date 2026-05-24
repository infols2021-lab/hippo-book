// app/(app)/portal/PortalClient.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, MouseEvent } from "react";
import PortalCard from "@/components/portal/PortalCard";
import LogoutButton from "@/components/LogoutButton";
import { BRANCH_CONFIGS } from "@/lib/branches/config";

type PortalClientProps = {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
};

function getDisplayName(userName: string, userEmail: string): string {
  const name = userName.trim();
  if (name) return name;

  const email = userEmail.trim();
  if (email) return email;

  return "ученик";
}

export default function PortalClient({ userName, userEmail, isAdmin }: PortalClientProps) {
  const displayName = getDisplayName(userName, userEmail);
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Кастомный перехват клика для запуска анимации портала перед редиректом
  const handleBranchClick = (e: MouseEvent<HTMLDivElement>, href: string) => {
    e.preventDefault();
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      router.push(href);
    }, 600000000000); // 600мс на красивый эффект затягивания
  };

  return (
    <main className={`portal-page ${isTransitioning ? "portal-active-warp" : ""}`}>
      <div className="portal-bg" aria-hidden="true">
        <div className="portal-bg__half portal-bg__half--olympiad" />
        <div className="portal-bg__half portal-bg__half--gatehouse" />
        <div className="portal-bg__divider" />
        <div className="portal-bg__orb portal-bg__orb--one" />
        <div className="portal-bg__orb portal-bg__orb--two" />
        <div className="portal-bg__grid" />
      </div>

      <section className="portal-shell">
        <header className="portal-header">
          <div>
            <p className="portal-eyebrow">Выберите направление</p>
            <h1 className="portal-title">Добро пожаловать, {displayName}</h1>
            <p className="portal-subtitle">
              One account, two spaces: olympiad and Gatehouse Awards exams.
            </p>
          </div>

          <div className="portal-header__actions">
            {isAdmin ? (
              <Link className="portal-header__link portal-header__link--admin" href="/admin">
                Панель управления
              </Link>
            ) : null}

            <LogoutButton className="portal-header__link portal-header__link--logout" />
          </div>
        </header>

        <div className="portal-split" aria-label="Выбор раздела платформы">
          <div 
            className="portal-split__side portal-split__side--olympiad"
            onClick={(e) => handleBranchClick(e, "/profile")}
            style={{ cursor: "pointer" }}
          >
            <PortalCard branch="olympiad" card={BRANCH_CONFIGS.olympiad.portalCard} side="left" />
          </div>

          <div 
            className="portal-split__side portal-split__side--gatehouse"
            onClick={(e) => handleBranchClick(e, "/gatehouse/profile")}
            style={{ cursor: "pointer" }}
          >
            <PortalCard branch="gatehouse" card={BRANCH_CONFIGS.gatehouse.portalCard} side="right" />
          </div>
        </div>

        <footer className="portal-footer">
          <span>Профильные данные общие для обоих разделов.</span>
          <span className="portal-footer__dot" aria-hidden="true" />
          <span>Прогресс и материалы разделяются отдельно.</span>
        </footer>
      </section>
    </main>
  );
}