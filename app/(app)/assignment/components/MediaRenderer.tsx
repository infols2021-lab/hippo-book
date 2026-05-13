"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { MediaAttachment } from "../lib/types";
import { getImageUrl } from "../lib/image";
import ImageModal from "./ImageModal"; // <-- новый импорт

// ============================================================================
// Глобальная синхронизация громкости между всеми плеерами на странице
// ============================================================================

const VOLUME_KEY = "hippo_audio_volume";
const VOLUME_EVENT = "hippo:volume-change";

function getInitialVolume(): number {
  try {
    const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "0.5");
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  } catch {
    return 0.5;
  }
}

function broadcastVolume(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
    window.dispatchEvent(
      new CustomEvent(VOLUME_EVENT, { detail: { volume: v } })
    );
  } catch {}
}

// ============================================================================
// Утилита форматирования времени
// ============================================================================

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ============================================================================
// КАСТОМНЫЙ АУДИОПЛЕЕР
// ============================================================================

function CustomAudioPlayer({ url, name }: { url: string; name?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isMounted = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Громкость — изначально половина (тише)
  const [volume, setVolume] = useState(0.5);

  const finalUrl = useMemo(() => getImageUrl(url), [url]);

  // Инициализация громкости после mount
  useEffect(() => {
    const v = getInitialVolume();
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    isMounted.current = true;
  }, []);

  // Сброс при смене трека
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    setLoading(true);
  }, [url]);

  // Применяем громкость к audio-элементу
  useEffect(() => {
    if (audioRef.current && isMounted.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Синхронизация с другими плеерами через window event
  useEffect(() => {
    function onVolumeSync(e: Event) {
      const v = (e as CustomEvent).detail?.volume;
      if (typeof v === "number" && Number.isFinite(v)) setVolume(v);
    }
    window.addEventListener(VOLUME_EVENT, onVolumeSync);
    return () => window.removeEventListener(VOLUME_EVENT, onVolumeSync);
  }, []);

  // Подписка на события audio-элемента
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(
        audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0
      );
    };
    const onLoaded = () => {
      setDuration(audio.duration);
      setLoading(false);
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setAudioError(true);
      setLoading(false);
    };
    const onCanPlay = () => setLoading(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || audioError) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setAudioError(true));
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || audioError || !duration) return;
    audioRef.current.currentTime = (Number(e.target.value) / 100) * duration;
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value) / 100;
    setVolume(v);
    broadcastVolume(v); // обновляет все плееры на странице + localStorage
  };

  const volIcon = volume === 0 ? "🔇" : volume < 0.4 ? "🔈" : volume < 0.75 ? "🔉" : "🔊";

  return (
    <div
      className="media-item-fade"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "20px",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
        width: "100%",
        maxWidth: "520px",
        margin: "10px 0",
      }}
    >
      <audio ref={audioRef} src={finalUrl} preload="metadata" />

      {/* ── Кнопка Play / Pause ── */}
      <button
        onClick={togglePlay}
        disabled={audioError || loading}
        style={{
          width: 46,
          height: 46,
          minWidth: 46,
          borderRadius: "50%",
          background: isPlaying ? "rgba(0,123,255,0.1)" : "#007bff",
          color: isPlaying ? "#007bff" : "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: audioError || loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: isPlaying ? "none" : "0 6px 15px rgba(0,123,255,0.3)",
          opacity: audioError || loading ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              width: 18,
              height: 18,
              border: "2px solid rgba(255,255,255,0.3)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
        ) : audioError ? (
          <span style={{ fontSize: 16 }}>⚠️</span>
        ) : isPlaying ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginLeft: 3 }}
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* ── Прогресс-бар + время ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {audioError ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c62828" }}>
            Не удалось загрузить аудио
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                minWidth: 35,
                color: "#475569",
                flexShrink: 0,
              }}
            >
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeek}
              style={{ flex: 1, cursor: "pointer", accentColor: "#007bff" }}
            />

            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                minWidth: 35,
                textAlign: "right",
                color: "#475569",
                flexShrink: 0,
              }}
            >
              {formatTime(duration)}
            </span>
          </div>
        )}
      </div>

      {/* ── Регулятор громкости ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
        title={`Громкость: ${Math.round(volume * 100)}%`}
      >
        <span style={{ fontSize: 14, lineHeight: 1, userSelect: "none" }}>
          {volIcon}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round(volume * 100)}
          onChange={handleVolume}
          style={{ width: 60, cursor: "pointer", accentColor: "#007bff" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ИЗОБРАЖЕНИЕ (без встроенной модалки, открывает ImageModal из родителя)
// ============================================================================

function ZoomableImage({
  url,
  name,
  onZoom, // <-- колбэк для открытия общей модалки
}: {
  url: string;
  name?: string;
  onZoom?: (imageUrl: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const finalUrl = useMemo(() => {
    const base = getImageUrl(url);
    if (!base) return "";
    if (retryCount === 0) return base;
    return `${base}${base.includes("?") ? "&" : "?"}retry=${retryCount}`;
  }, [url, retryCount]);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
  }, [finalUrl]);

  const handleRetry = useCallback(() => setRetryCount((c) => c + 1), []);

  const handleClick = () => {
    if (!isLoading && !hasError && onZoom) {
      onZoom(finalUrl);
    }
  };

  return (
    <div
      className="media-item-fade"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isLoading ? "default" : "zoom-in",
        margin: "12px 0",
        borderRadius: "20px",
        overflow: "hidden",
        background: "#f8fafc",
        minHeight: "200px",
        width: "100%",
        maxWidth: "600px",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
      onClick={handleClick}
    >
      {isLoading && !hasError && (
        <div className="media-loader">
          <div className="spinner" />
        </div>
      )}

      {hasError ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Не удалось загрузить фото
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Повторить загрузку
          </button>
        </div>
      ) : (
        <img
          src={finalUrl}
          alt={name || "Task Image"}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
          loading="lazy"
          decoding="async"
          style={{
            width: "100%",
            maxHeight: "400px",
            objectFit: "contain",
            display: "block",
            transition: "opacity 0.4s ease",
            opacity: isLoading ? 0 : 1,
          }}
        />
      )}

      {!isLoading && !hasError && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            background: "rgba(0,0,0,0.5)",
            color: "#fff",
            padding: "5px 10px",
            borderRadius: 10,
            backdropFilter: "blur(4px)",
            fontSize: 11,
            fontWeight: 800,
            pointerEvents: "none",
            textTransform: "uppercase",
          }}
        >
          🔍 Увеличить
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PDF VIEWER (без изменений)
// ============================================================================

function PdfViewer({ url, name }: { url: string; name?: string }) {
  const finalUrl = useMemo(() => getImageUrl(url), [url]);

  return (
    <div
      className="media-item-fade"
      style={{ margin: "16px 0", width: "100%", maxWidth: 800 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f1f5f9",
          padding: "12px 18px",
          borderRadius: "16px 16px 0 0",
          border: "1px solid #e2e8f0",
          borderBottom: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#475569",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name || "PDF Document"}
          </span>
        </div>
        <a
          href={finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            color: "#007bff",
            fontWeight: 800,
            textDecoration: "none",
            background: "#fff",
            padding: "6px 12px",
            borderRadius: 12,
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          }}
        >
          ОТКРЫТЬ ↗
        </a>
      </div>
      <div
        style={{
          height: 500,
          borderRadius: "0 0 16px 16px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <iframe src={`${finalUrl}#toolbar=0`} width="100%" height="100%" style={{ border: "none" }} />
      </div>
    </div>
  );
}

// ============================================================================
// ГЛАВНЫЙ РЕНДЕРЕР
// ============================================================================

export default function MediaRenderer({ media }: { media?: MediaAttachment[] }) {
  // Состояние для общего ImageModal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState("");
  const [imageModalZoom, setImageModalZoom] = useState(1);

  const handleZoom = useCallback((src: string) => {
    setImageModalSrc(src);
    setImageModalZoom(1);
    setImageModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setImageModalOpen(false);
  }, []);

  if (!media || media.length === 0) return null;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        {media.map((m) => {
          if (!m.url) return null;
          const key = `${m.id}-${m.url}`;
          if (m.type === "audio")
            return <CustomAudioPlayer key={key} url={m.url} name={m.name} />;
          if (m.type === "image")
            return <ZoomableImage key={key} url={m.url} name={m.name} onZoom={handleZoom} />;
          if (m.type === "pdf")
            return <PdfViewer key={key} url={m.url} name={m.name} />;
          return null;
        })}

        <style jsx global>{`
          .media-item-fade {
            animation: mediaAppear 0.4s ease-out forwards;
          }
          @keyframes mediaAppear {
            from { opacity: 0; transform: translateY(5px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .media-loader {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
          }
          .spinner {
            width: 30px;
            height: 30px;
            border: 3px solid rgba(0, 123, 255, 0.1);
            border-top-color: #007bff;
            border-radius: 50%;
            animation: mediaSpin 0.8s linear infinite;
          }
          @keyframes mediaSpin { to { transform: rotate(360deg); } }
          @keyframes spin      { to { transform: rotate(360deg); } }
        `}</style>
      </div>

      {/* Единый ImageModal для всех картинок */}
      <ImageModal
        open={imageModalOpen}
        src={imageModalSrc}
        zoom={imageModalZoom}
        setZoom={setImageModalZoom}
        onClose={handleCloseModal}
      />
    </>
  );
}