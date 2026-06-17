"use client";

import React from "react";
import type { InfoBlock } from "@/app/(admin)/admin/assignments/builder/types";

// Импортируем все визуальные компоненты блоков из отдельного файла
import {
  HeroView, 
  TextSectionView, 
  AlertView, 
  VideoView,
  CardsGridView, 
  AccordionView, 
  DownloadsView
} from "./blocks/InformationalBlocks";

type Props = {
  blocks: InfoBlock[];
  onComplete: () => void;
  disabled?: boolean;
  isSaving?: boolean;
};

// ==========================================
// ГЛАВНЫЙ РЕНДЕРЕР (СОБИРАЕТ ВСЁ ВМЕСТЕ)
// ==========================================

export default function BlockRenderer({ blocks, onComplete, disabled, isSaving }: Props) {
  
  // Пробегаемся по массиву блоков и рендерим нужный UI
  const renderBlock = (block: InfoBlock) => {
    switch (block.type) {
      case "hero": return <HeroView key={block.id} data={block.data} />;
      case "text_section": return <TextSectionView key={block.id} data={block.data} />;
      case "alert": return <AlertView key={block.id} data={block.data} />;
      case "video": return <VideoView key={block.id} data={block.data} />;
      case "cards_grid": return <CardsGridView key={block.id} data={block.data} />;
      case "accordion": return <AccordionView key={block.id} data={block.data} />;
      case "downloads": return <DownloadsView key={block.id} data={block.data} />;
      default: return null;
    }
  };

  return (
    <div style={{ 
      maxWidth: "860px", 
      margin: "0 auto", 
      padding: "20px", 
      fontFamily: "var(--font-geist-sans), 'Inter', sans-serif" 
    }}>
      
      {/* Рендерим все созданные админом блоки */}
      {blocks.map(renderBlock)}

      {/* Финальный блок: Подтверждение изучения */}
      {!disabled && (
        <div style={{
          marginTop: "64px",
          background: "linear-gradient(135deg, #0f2444 0%, #1a3a6b 100%)",
          borderRadius: "16px",
          padding: "40px 28px",
          textAlign: "center",
          color: "white",
          boxShadow: "0 10px 30px rgba(15, 36, 68, 0.2)"
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: 900, marginBottom: "12px", letterSpacing: "-0.02em" }}>
            Всё готово?
          </h2>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", marginBottom: "32px", maxWidth: "440px", margin: "0 auto 32px" }}>
            Убедитесь, что вы ознакомились со всеми материалами. После нажатия кнопки этот гайд будет отмечен как пройденный.
          </p>
          <button 
            onClick={onComplete}
            disabled={isSaving}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              background: "#4ade9a", color: "#0d3d2a", padding: "14px 32px",
              borderRadius: "999px", fontSize: "16px", fontWeight: 900,
              border: "none", cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1, transition: "transform 0.1s"
            }}
          >
            {isSaving ? "Сохраняем..." : "✅ Отметить как изученное"}
          </button>
        </div>
      )}
    </div>
  );
}