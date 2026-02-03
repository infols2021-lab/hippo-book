"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          "timeout-callback"?: () => void;
        }
      ) => string;
      reset?: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

type Status = "idle" | "loading" | "ready" | "error";

export default function TurnstileWidget(props: {
  siteKey: string;
  action: string;
  reloadNonce: number;
  onToken: (token: string | null) => void;
  onStatus?: (s: Status) => void;
}) {
  const { siteKey, action, reloadNonce, onToken, onStatus } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptAddedRef = useRef(false);

  const [status, setStatus] = useState<Status>("idle");

  function setBoth(s: Status) {
    setStatus(s);
    onStatus?.(s);
  }

  const scriptSrc = useMemo(
    () => "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    []
  );

  useEffect(() => {
    setBoth("loading");

    // 1) Ensure script
    if (!scriptAddedRef.current) {
      scriptAddedRef.current = true;

      // prevent duplicates
      const existing = document.querySelector(`script[src="${scriptSrc}"]`) as HTMLScriptElement | null;
      if (!existing) {
        const s = document.createElement("script");
        s.src = scriptSrc;
        s.async = true;
        s.defer = true;

        s.onload = () => {
          // render will happen in next effect tick
        };
        s.onerror = () => {
          setBoth("error");
          onToken(null);
        };

        document.head.appendChild(s);
      }
    }

    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function waitAndRender() {
      onToken(null);
      setBoth("loading");

      // cleanup previous widget
      try {
        if (widgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {}
      widgetIdRef.current = null;

      // clear container
      if (containerRef.current) containerRef.current.innerHTML = "";

      // wait for turnstile global
      const start = Date.now();
      while (!cancelled && !window.turnstile && Date.now() - start < 6000) {
        await new Promise((r) => setTimeout(r, 100));
      }

      if (cancelled) return;

      if (!window.turnstile || !containerRef.current) {
        setBoth("error");
        onToken(null);
        return;
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => {
            if (cancelled) return;
            onToken(token);
            setBoth("ready");
          },
          "error-callback": () => {
            if (cancelled) return;
            onToken(null);
            setBoth("error");
          },
          "expired-callback": () => {
            if (cancelled) return;
            onToken(null);
            setBoth("ready"); // widget still visible, just token expired
          },
          "timeout-callback": () => {
            if (cancelled) return;
            onToken(null);
            setBoth("error");
          },
        });

        widgetIdRef.current = id;
        // If user sees widget but no token yet — status should become ready shortly
        setTimeout(() => {
          if (!cancelled && status !== "error") setBoth("ready");
        }, 300);
      } catch {
        onToken(null);
        setBoth("error");
      }
    }

    void waitAndRender();

    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {}
      widgetIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action, reloadNonce]);

  return (
    <div style={{ marginTop: 10 }}>
      <div ref={containerRef} />
      {/* status is handled by parent, no UI here */}
    </div>
  );
}
