// components/SmartBackButton.tsx
"use client";

import { useRouter } from "next/navigation";

export default function SmartBackButton() {
  const router = useRouter();

  return (
    <button 
      onClick={() => router.back()} 
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