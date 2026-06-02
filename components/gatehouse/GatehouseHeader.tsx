// components/gatehouse/GatehouseHeader.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

type GatehouseHeaderAction = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type GatehouseHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: GatehouseHeaderAction[];
  children?: ReactNode;
};

export default function GatehouseHeader({
  eyebrow = "Gatehouse Awards",
  title,
  description,
  backHref,
  backLabel = "Назад",
  actions = [],
  children,
}: GatehouseHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="gatehouse-header">
      <div className="gatehouse-header__bg" aria-hidden="true">
        <div className="gatehouse-header__orb gatehouse-header__orb--one" />
        <div className="gatehouse-header__orb gatehouse-header__orb--two" />
        <div className="gatehouse-header__grid" />
      </div>

      <div className="gatehouse-header__inner">
        <div className="gatehouse-header__top">
          {backHref ? (
            <Link href={backHref} className="gatehouse-header__back">
              <span aria-hidden="true">←</span>
              <span>{backLabel}</span>
            </Link>
          ) : (
            <div />
          )}

          {/* Бургер-кнопка теперь отображается всегда на мобильных, так как навигация есть всегда */}
          <button
            className="gatehouse-header__burger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Открыть меню"
          >
            <span aria-hidden="true">☰</span>
          </button>

          <div className={`gatehouse-header__actions ${mobileMenuOpen ? "gatehouse-header__actions--open" : ""}`}>
            
            {/* Глобальные кнопки навигации (присутствуют на всех страницах Gatehouse) */}
            <Link href="/info" className="gatehouse-header__action" onClick={() => setMobileMenuOpen(false)}>
              <span>Информация</span>
            </Link>

            <Link href="/gatehouse/profile" className="gatehouse-header__action" onClick={() => setMobileMenuOpen(false)}>
              <span>Профиль экзаменов</span>
            </Link>

            <Link 
              href="/profile" 
              className="gatehouse-header__action" 
              style={{ background: 'linear-gradient(135deg, #4ecdc4, #556270)', color: '#fff', borderColor: 'transparent' }} 
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>🏆 В Олимпиаду</span>
            </Link>

            {/* Специфичные кнопки для конкретной страницы, переданные через props */}
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                className="gatehouse-header__action"
                onClick={() => setMobileMenuOpen(false)}
              >
                {action.icon ? <span className="gatehouse-header__action-icon">{action.icon}</span> : null}
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="gatehouse-header__main">
          <div className="gatehouse-header__badge">
            <span className="gatehouse-header__badge-dot" aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>

          <h1 className="gatehouse-header__title">{title}</h1>

          {description ? <p className="gatehouse-header__description">{description}</p> : null}

          {children ? <div className="gatehouse-header__content">{children}</div> : null}
        </div>
      </div>
    </header>
  );
}