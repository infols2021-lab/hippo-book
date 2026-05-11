"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { MediaAttachment } from "../lib/types";
import { getImageUrl } from "../lib/image";

// ============================================================================
// Утилита для форматирования времени (секунды -> мм:сс)
// ============================================================================
function formatTime(timeInSeconds: number) {
  if (isNaN(timeInSeconds)) return "00:00";

  const m = Math.floor(timeInSeconds / 60);
  const s = Math.floor(timeInSeconds % 60);

  return `${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

// ============================================================================
// КАСТОМНЫЙ АУДИОПЛЕЕР
// ============================================================================
function CustomAudioPlayer({
  url,
  name,
}: {
  url: string;
  name?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [loading, setLoading] = useState(true);

  const finalUrl = useMemo(() => getImageUrl(url), [url]);

  // Сброс при смене URL
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    setLoading(true);
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100 || 0);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const handleEnded = () => setIsPlaying(false);

    const handleError = () => {
      setAudioError(true);
      setLoading(false);
    };

    const handleCanPlay = () => {
      setLoading(false);
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current || audioError) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        setAudioError(true);
      });

      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || audioError) return;

    const newTime = (Number(e.target.value) / 100) * duration;

    audioRef.current.currentTime = newTime;
  };

  return (
    <div
      className="media-item-fade"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "12px 20px",
        borderRadius: "20px",
        background: "rgba(255,255,255,0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
        width: "100%",
        maxWidth: "450px",
        margin: "10px 0",
      }}
    >
      <audio ref={audioRef} src={finalUrl} preload="metadata" />

      <button
        onClick={togglePlay}
        disabled={audioError || loading}
        style={{
          width: "46px",
          height: "46px",
          minWidth: "46px",
          borderRadius: "50%",
          background: isPlaying
            ? "rgba(0,123,255,0.1)"
            : "#007bff",
          color: isPlaying ? "#007bff" : "#fff",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor:
            audioError || loading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          boxShadow: isPlaying
            ? "none"
            : "0 6px 15px rgba(0,123,255,0.3)",
          opacity: audioError || loading ? 0.6 : 1,
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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginLeft: "3px" }}
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {name && (
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              opacity: 0.8,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
        )}

        {audioError ? (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#c62828",
            }}
          >
            Не удалось загрузить аудио
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                minWidth: "35px",
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
              style={{
                flex: 1,
                cursor: "pointer",
              }}
            />

            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                minWidth: "35px",
                textAlign: "right",
              }}
            >
              {formatTime(duration)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ИЗОБРАЖЕНИЕ
// ============================================================================
function ZoomableImage({
  url,
  name,
}: {
  url: string;
  name?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
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

  const handleRetry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return (
    <>
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
        onClick={() =>
          !isLoading && !hasError && setIsOpen(true)
        }
      >
        {isLoading && !hasError && (
          <div className="media-loader">
            <div className="spinner"></div>
          </div>
        )}

        {hasError ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#94a3b8",
            }}
          >
            <div
              style={{
                fontSize: "32px",
                marginBottom: 8,
              }}
            >
              ⚠️
            </div>

            <div
              style={{
                fontSize: "14px",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
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
                borderRadius: "8px",
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
              bottom: "12px",
              right: "12px",
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              padding: "5px 10px",
              borderRadius: "10px",
              backdropFilter: "blur(4px)",
              fontSize: "11px",
              fontWeight: 800,
              pointerEvents: "none",
              textTransform: "uppercase",
            }}
          >
            🔍 Увеличить
          </div>
        )}
      </div>

      {isOpen && !hasError && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.9)",
            backdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            padding: "20px",
          }}
        >
          <img
            src={finalUrl}
            alt="Full"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: "12px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          />

          <button
            onClick={() => setIsOpen(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "30px",
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: "40px",
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}

// ============================================================================
// ПРОСМОТРЩИК PDF
// ============================================================================
function PdfViewer({
  url,
  name,
}: {
  url: string;
  name?: string;
}) {
  const finalUrl = useMemo(() => getImageUrl(url), [url]);

  return (
    <div
      className="media-item-fade"
      style={{
        margin: "16px 0",
        width: "100%",
        maxWidth: "800px",
      }}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            overflow: "hidden",
          }}
        >
          <span style={{ fontSize: "18px" }}>📄</span>

          <span
            style={{
              fontSize: "13px",
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
            fontSize: "11px",
            color: "#007bff",
            fontWeight: 800,
            textDecoration: "none",
            background: "#fff",
            padding: "6px 12px",
            borderRadius: "12px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
          }}
        >
          ОТКРЫТЬ ↗
        </a>
      </div>

      <div
        style={{
          height: "500px",
          borderRadius: "0 0 16px 16px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <iframe
          src={`${finalUrl}#toolbar=0`}
          width="100%"
          height="100%"
          style={{ border: "none" }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// ГЛАВНЫЙ РЕНДЕРЕР
// ============================================================================
export default function MediaRenderer({
  media,
}: {
  media?: MediaAttachment[];
}) {
  if (!media || media.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
      }}
    >
      {media.map((m) => {
        if (!m.url) return null;

        const uniqueKey = `${m.id}-${m.url}`;

        if (m.type === "audio") {
          return (
            <CustomAudioPlayer
              key={uniqueKey}
              url={m.url}
              name={m.name}
            />
          );
        }

        if (m.type === "image") {
          return (
            <ZoomableImage
              key={uniqueKey}
              url={m.url}
              name={m.name}
            />
          );
        }

        if (m.type === "pdf") {
          return (
            <PdfViewer
              key={uniqueKey}
              url={m.url}
              name={m.name}
            />
          );
        }

        return null;
      })}

      <style jsx global>{`
        .media-item-fade {
          animation: mediaAppear 0.4s ease-out forwards;
        }

        @keyframes mediaAppear {
          from {
            opacity: 0;
            transform: translateY(5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
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

        @keyframes mediaSpin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}