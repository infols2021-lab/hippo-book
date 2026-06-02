// components/SmartBackButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function SmartBackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()} 
      className="back-link" // Используем твой класс из стилей
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '8px',
        padding: '8px 14px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#e2e8f0',
        borderRadius: '10px',
        fontWeight: 700,
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
    >
      <span aria-hidden="true">←</span> Назад
    </button>
  );
}