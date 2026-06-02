// components/gatehouse/GatehouseHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function GatehouseHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname() || "";

  // Функция для определения активного роута
  const getLinkProps = (path: string) => {
    // Проверяем, находимся ли мы на этой странице
    const isActive = pathname === path || (path !== "/portal" && path !== "/info" && pathname.startsWith(`${path}/`));
    
    return {
      href: path,
      className: "btn ghost",
      // Если страница активна, кнопка становится подсвеченной и некликабельной
      style: isActive ? {
        background: 'rgba(99,102,241,0.2)',
        borderColor: 'rgba(99,102,241,0.4)',
        color: '#818cf8',
        pointerEvents: 'none' as const,
        margin: 0
      } : { margin: 0 },
      onClick: () => setMobileMenuOpen(false)
    };
  };

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '32px', 
      flexWrap: 'wrap', 
      gap: '14px', 
      background: 'rgba(30, 41, 59, 0.4)', 
      backdropFilter: 'blur(12px)', 
      padding: '14px 20px', 
      borderRadius: '20px', 
      border: '1px solid rgba(255,255,255,0.05)' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #6366f1, #a855f7)', 
          color: 'white', 
          width: '42px', 
          height: '42px', 
          borderRadius: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontWeight: 900, 
          fontSize: '18px', 
          boxShadow: '0 8px 16px rgba(99,102,241,0.25)' 
        }}>GA</div>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>Экзамены Gatehouse</h3>
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Образовательная платформа</div>
        </div>
      </div>
      
      <button
        className="gatehouse-header__burger"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Открыть меню"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* Контейнер ссылок */}
      <div className={`gatehouse-nav-actions ${mobileMenuOpen ? "open" : ""}`}>
        <Link {...getLinkProps("/info")}>Информация</Link>
        <Link {...getLinkProps("/gatehouse/materials")}>Материалы</Link>
        <Link {...getLinkProps("/gatehouse/profile")}>Профиль</Link>
        <Link {...getLinkProps("/portal")}>Портал</Link>
        
        <LogoutButton className="btn danger">Выйти</LogoutButton>
      </div>
    </header>
  );
}