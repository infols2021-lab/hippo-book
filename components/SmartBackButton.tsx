// components/SmartBackButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Props = {
  /** Куда уходить, если истории назад нет (прямой заход / открытие в новой вкладке). */
  fallbackHref?: string;
};

export default function SmartBackButton({ fallbackHref = "/info" }: Props = {}) {
  const router = useRouter();

  // history.length === 1 означает первую страницу вкладки (пользователь зашёл
  // напрямую по ссылке) — тогда router.back() «ничего не делает». Поэтому длину
  // истории читаем прямо в момент клика и при невозможности вернуться назад
  // безопасно уходим на fallback (/info), а не молчим.
  const handleBack = useCallback(() => {
    const canGoBack = typeof window !== "undefined" && window.history.length > 1;
    if (canGoBack) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [fallbackHref, router]);

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Назад"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 20px',
        background: '#ffffff',
        border: '2px solid #e2e8f0',
        color: '#475569',
        borderRadius: '12px',
        fontWeight: 800,
        fontSize: '15px',
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f8fafc';
        e.currentTarget.style.borderColor = '#cbd5e1';
        e.currentTarget.style.color = '#0f172a';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#ffffff';
        e.currentTarget.style.borderColor = '#e2e8f0';
        e.currentTarget.style.color = '#475569';
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '18px', lineHeight: 1 }}>←</span> Назад
    </button>
  );
}