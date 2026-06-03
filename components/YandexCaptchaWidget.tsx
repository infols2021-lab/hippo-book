"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    ym?: {
      init: (
        container: HTMLElement,
        params: {
          sitekey: string;
          theme?: "light" | "dark";
          hl?: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
        }
      ) => void;
    };
  }
}

type Props = {
  siteKey: string;
  reloadNonce: number;
  onToken: (token: string | null) => void;
};

export default function YandexCaptchaWidget({ siteKey, reloadNonce, onToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  const initCaptcha = () => {
    if (!containerRef.current || !window.ym) return;

    try {
      // Очищаем контейнер от старых виджетов
      containerRef.current.innerHTML = "";

      window.ym.init(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        hl: "ru",
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(null),
      });

      initializedRef.current = true;
    } catch (e) {
      console.error("Yandex Captcha init error:", e);
      onToken(null);
    }
  };

  const loadScript = async () => {
    if (scriptLoadedRef.current) return;

    // Если скрипт уже есть в DOM, считаем загруженным
    if (document.getElementById("yandex-captcha-script")) {
      scriptLoadedRef.current = true;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.id = "yandex-captcha-script";
      script.src = "https://captcha-api.yandex.ru/captcha.js";
      script.async = true;

      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error("Failed to load Yandex Captcha script"));
      };

      document.head.appendChild(script);
    });
  };

  // Основной эффект: загрузка скрипта + ожидание window.ym
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    let interval: NodeJS.Timeout | null = null;

    const tryInit = () => {
      if (window.ym) {
        if (interval) clearInterval(interval);
        initCaptcha();
      } else if (retryCount < 50) { // максимум 5 секунд
        retryCount++;
      } else {
        if (interval) clearInterval(interval);
        console.error("window.ym not available after 5 seconds");
        onToken(null);
      }
    };

    loadScript()
      .then(() => {
        if (!isMounted) return;
        interval = setInterval(tryInit, 100);
      })
      .catch((err) => {
        console.error(err);
        onToken(null);
      });

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [siteKey]);

  // Перезагрузка капчи при изменении reloadNonce
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!containerRef.current) return;

    initializedRef.current = false;
    if (containerRef.current) containerRef.current.innerHTML = "";

    const timer = setTimeout(() => {
      if (window.ym && containerRef.current && !initializedRef.current) {
        initCaptcha();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [reloadNonce]);

  return (
    <div style={{ marginTop: 16, minHeight: 100, textAlign: "center" }}>
      <div ref={containerRef} style={{ display: "inline-block" }} />
    </div>
  );
}