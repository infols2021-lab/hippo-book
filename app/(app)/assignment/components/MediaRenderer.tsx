"use client";

import React, { useState, useRef, useEffect } from "react";
import type { MediaAttachment } from "../lib/types";

// ============================================================================
// Утилита для форматирования времени (секунды -> мм:сс)
// ============================================================================
function formatTime(timeInSeconds: number) {
  if (isNaN(timeInSeconds)) return "00:00";
  const m = Math.floor(timeInSeconds / 60);
  const s = Math.floor(timeInSeconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ============================================================================
// КАСТОМНЫЙ АУДИОПЛЕЕР (Glassmorphism & Premium UI)
// ============================================================================
function CustomAudioPlayer({ url, name }: { url: string; name?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = (Number(e.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setProgress(Number(e.target.value));
    setCurrentTime(newTime);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "12px 20px",
        borderRadius: "24px",
        background: "rgba(255, 255, 255, 0.6)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.8)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
        width: "100%",
        maxWidth: "400px",
        margin: "8px 0",
      }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Кнопка Play / Pause */}
      <button
        onClick={togglePlay}
        style={{
          width: "44px",
          height: "44px",
          minWidth: "44px",
          borderRadius: "50%",
          background: isPlaying ? "rgba(0, 123, 255, 0.1)" : "#007bff",
          color: isPlaying ? "#007bff" : "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
          boxShadow: isPlaying ? "none" : "0 4px 12px rgba(0, 123, 255, 0.3)",
        }}
      >
        {isPlaying ? (
          // Иконка Pause
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          // Иконка Play
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "4px" }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Прогресс-бар и время */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
        {name && (
          <div style={{ fontSize: "12px", fontWeight: 600, color: "rgba(0,0,0,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </div>
        )}
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)", fontWeight: 500, minWidth: "36px" }}>
            {formatTime(currentTime)}
          </span>
          
          <input
            type="range"
            min="0"
            max="100"
            value={progress || 0}
            onChange={handleSeek}
            style={{
              flex: 1,
              height: "6px",
              WebkitAppearance: "none",
              appearance: "none",
              background: `linear-gradient(to right, #007bff ${progress}%, rgba(0,0,0,0.1) ${progress}%)`,
              borderRadius: "4px",
              cursor: "pointer",
              outline: "none",
            }}
          />
          <style dangerouslySetInnerHTML={{ __html: `
            input[type=range]::-webkit-slider-thumb {
              -webkit-appearance: none;
              appearance: none;
              width: 14px;
              height: 14px;
              border-radius: 50%;
              background: #007bff;
              cursor: pointer;
              box-shadow: 0 2px 6px rgba(0, 123, 255, 0.4);
              border: 2px solid #fff;
            }
          `}} />

          <span style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)", fontWeight: 500, minWidth: "36px", textAlign: "right" }}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ИЗОБРАЖЕНИЕ С ФУНКЦИЕЙ ZOOM (Lightbox)
// ============================================================================
function ZoomableImage({ url, name }: { url: string; name?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        style={{ 
          position: "relative", 
          display: "inline-block", 
          cursor: "zoom-in",
          margin: "8px 0"
        }}
        onClick={() => setIsOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name || "Медиа"}
          style={{
            maxWidth: "100%",
            maxHeight: "300px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.05)",
            objectFit: "contain",
            display: "block",
            transition: "transform 0.2s ease",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        />
        <div style={{
          position: "absolute",
          bottom: "10px",
          right: "10px",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: "8px",
          backdropFilter: "blur(4px)",
          fontSize: "12px",
          pointerEvents: "none"
        }}>
          🔍 Увеличить
        </div>
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            padding: "20px"
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name || "Медиа (увеличено)"}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: "8px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              fontSize: "24px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s ease"
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.4)")}
            onMouseOut={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// ПРОСМОТРЩИК PDF
// ============================================================================
function PdfViewer({ url, name }: { url: string; name?: string }) {
  return (
    <div style={{ margin: "12px 0", width: "100%", maxWidth: "800px" }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(0,0,0,0.03)",
        padding: "12px 16px",
        borderRadius: "12px 12px 0 0",
        border: "1px solid rgba(0,0,0,0.08)",
        borderBottom: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <span style={{ fontSize: "20px" }}>📄</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "rgba(0,0,0,0.7)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name || "PDF Документ"}
          </span>
        </div>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            fontSize: "13px",
            color: "#007bff",
            textDecoration: "none",
            fontWeight: 500,
            background: "rgba(0, 123, 255, 0.1)",
            padding: "6px 12px",
            borderRadius: "16px",
            whiteSpace: "nowrap"
          }}
        >
          Открыть в новой вкладке ↗
        </a>
      </div>
      <div style={{
        height: "500px",
        borderRadius: "0 0 12px 12px",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#f8f9fa",
      }}>
        <iframe
          src={`${url}#toolbar=0`}
          width="100%"
          height="100%"
          style={{ border: "none" }}
          title={name || "PDF Viewer"}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ГЛАВНЫЙ КОМПОНЕНТ-РЕНДЕРЕР
// ============================================================================
export default function MediaRenderer({ media }: { media?: MediaAttachment[] }) {
  if (!media || media.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {media.map((m) => {
        if (m.type === "audio") {
          return <CustomAudioPlayer key={m.id} url={m.url} name={m.name} />;
        }
        if (m.type === "image") {
          return <ZoomableImage key={m.id} url={m.url} name={m.name} />;
        }
        if (m.type === "pdf") {
          return <PdfViewer key={m.id} url={m.url} name={m.name} />;
        }
        // Fallback для неизвестных типов
        return (
          <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: "#007bff" }}>
            📎 Открыть файл ({m.name || "ссылка"})
          </a>
        );
      })}
    </div>
  );
}