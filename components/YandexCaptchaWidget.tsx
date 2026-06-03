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

export default function YandexCaptcha({
  siteKey,
  reloadNonce,
  onToken,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  const initCaptcha = () => {
    if (!containerRef.current || !window.ym) return;

    try {
      containerRef.current.innerHTML = "";

      window.ym.init(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        hl: "ru",
        callback: (token: string) => {
          onToken(token);
        },
        "error-callback": () => {
          onToken(null);
        },
      });

      initializedRef.current = true;
    } catch (e) {
      console.error("Captcha init error:", e);
      onToken(null);
    }
  };

  const loadScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (scriptLoadedRef.current) return resolve();

      if (document.getElementById("yandex-captcha-script")) {
        scriptLoadedRef.current = true;
        return resolve();
      }

      const script = document.createElement("script");
      script.id = "yandex-captcha-script";
      script.src = "https://captcha-api.yandex.ru/captcha.js";
      script.async = true;

      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve();
      };

      script.onerror = () => {
        reject("Failed to load captcha script");
      };

      document.head.appendChild(script);
    });
  };

  // initial load
  useEffect(() => {
    let mounted = true;

    loadScript()
      .then(() => {
        if (!mounted) return;
        initCaptcha();
      })
      .catch((err) => {
        console.error(err);
        onToken(null);
      });

    return () => {
      mounted = false;
    };
  }, [siteKey]);

  // reload captcha
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!containerRef.current) return;

    initializedRef.current = false;
    containerRef.current.innerHTML = "";

    const t = setTimeout(() => {
      initCaptcha();
    }, 200);

    return () => clearTimeout(t);
  }, [reloadNonce]);

  return (
    <div style={{ width: "100%", minHeight: 160 }}>
      <div ref={containerRef} />
    </div>
  );
}