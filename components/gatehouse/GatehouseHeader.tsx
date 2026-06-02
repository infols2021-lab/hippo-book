"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "@/components/LogoutButton";

export default function GatehouseHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname() || "";

  // Стили для ссылок
  const getLinkStyle = (isActive: boolean) => ({
    padding: "10px 20px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    transition: "all 0.25s ease",
    color: isActive ? "#ffffff" : "#94a3b8",
    background: isActive ? "#4338ca" : "transparent",
    border: "1px solid transparent",
  });

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '32px', 
      flexWrap: 'wrap', 
      gap: '14px', 
      background: 'rgba(30, 41, 59, 0.5)', 
      backdropFilter: 'blur(16px)', 
      padding: '12px 20px', 
      borderRadius: '20px', 
      border: '1px solid rgba(255,255,255,0.08)' 
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
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Образовательная платформа</div>
        </div>
      </div>
      
      <button
        className="gatehouse-header__burger"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Открыть меню"
        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* Контейнер ссылок */}
      <nav className={`gatehouse-nav-actions ${mobileMenuOpen ? "open" : ""}`} style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {[
          { href: "/info", label: "Информация" },
          { href: "/gatehouse/materials", label: "Материалы" },
          { href: "/gatehouse/profile", label: "Профиль" },
          { href: "/portal", label: "Портал" },
        ].map((item) => {
          const isActive = pathname === item.href || (item.href !== "/portal" && item.href !== "/info" && pathname.startsWith(`${item.href}/`));
          
          return (
            <Link 
              key={item.href}
              href={item.href} 
              style={getLinkStyle(isActive)}
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
        
        {/* Кнопка выхода без style, используем className для стилизации */}
        <div style={{ marginLeft: "8px" }}>
          <LogoutButton className="btn danger">
            Выйти
          </LogoutButton>
        </div>
      </nav>

      {/* CSS для мобильного отображения */}
      <style jsx>{`
        .gatehouse-nav-actions { display: flex; align-items: center; }
        @media (max-width: 768px) {
          .gatehouse-nav-actions { display: ${mobileMenuOpen ? 'flex' : 'none'}; flex-direction: column; width: 100%; gap: 8px; }
          .gatehouse-header__burger { display: block; }
        }
        @media (min-width: 769px) {
          .gatehouse-header__burger { display: none; }
        }
      `}</style>
    </header>
  );
}