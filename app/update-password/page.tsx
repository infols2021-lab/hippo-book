"use client";

import "./update-password.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import YandexCaptchaWidget from "@/components/YandexCaptchaWidget";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

type ApiPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  data?: any;
  authenticated?: boolean;
  hasSession?: boolean;
};

async function readApiPayload(res: Response): Promise<ApiPayload | null> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as ApiPayload;
  } catch {
    return {
      ok: false,
      error: text,
    };
  }
}

function unwrapApiData(json: ApiPayload | null) {
  if (!json) return null;
  if (json.data && typeof json.data === "object") return json.data;
  return json;
}

export default function UpdatePasswordPage() {
  // ✅ Используем ключ для Яндекс Капчи
  const siteKey = process.env.NEXT_PUBLIC_YANDEX_CAPTCHA_SITE_KEY || "";

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [busy, setBusy] = useState(false);

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");

  function showBanner(type: BannerType, text: string) {
    setBannerType(type);
    setBannerText(text);
  }

  function clearBanner() {
    setBannerType(null);
    setBannerText("");
  }

  function openModal(kind: ModalKind, title: string, body: string) {
    setModalKind(kind);
    setModalTitle(title);
    setModalBody(body);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setBusy(false);
    clearBanner();
  }

  function resetCaptchaHard() {
    setCaptchaToken(null);
    setReloadNonce((n) => n + 1);
  }

  function friendlyErrorFromApi(payload: any, status: number) {
    const code = String(payload?.code || "").toUpperCase();
    const err = String(payload?.error || payload?.message || "").trim();

    if (
      code.includes("CAPTCHA") ||
      code.includes("TURNSTILE") ||
      err.toLowerCase().includes("captcha") ||
      err.toLowerCase().includes("капч") ||
      err.toLowerCase().includes("проверк")
    ) {
      return (
        (err || "Проверка не пройдена или не загрузилась.") +
        "\n\nПопробуйте:\n" +
        "• Нажать «Перезагрузить проверку»\n" +
        "• Отключить VPN/прокси\n" +
        "• Обновить страницу"
      );
    }

    if (code === "NO_SESSION" || code === "UNAUTHORIZED" || status === 401) {
      return (
        err ||
        "Сессия восстановления не найдена или устарела.\n\nЗапросите восстановление заново и перейдите по новой ссылке из письма."
      );
    }

    if (code === "INVALID_OR_EXPIRED_LINK") {
      return err || "Ссылка недействительна или устарела. Запросите восстановление заново.";
    }

    if (code === "VALIDATION") return err || "Проверьте пароль (не менее 6 символов).";

    if (err) return err;

    return `Не удалось обновить пароль (${status}). Попробуйте перезагрузить проверку и повторить.`;
  }

  useEffect(() => {
    let cancelled = false;

    async function exchangeRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const res = await fetch("/api/auth/exchange-code", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        const json = await readApiPayload(res);
        const payload = unwrapApiData(json);

        window.history.replaceState({}, "", "/update-password");

        if (!res.ok || !json?.ok) {
          throw new Error(
            payload?.error ||
              payload?.message ||
              json?.error ||
              "Ссылка недействительна или устарела. Запросите восстановление заново.",
          );
        }

        return Boolean(payload?.hasSession);
      }

      const hash = window.location.hash || "";

      if (hash.includes("access_token=") && hash.includes("refresh_token=")) {
        const p = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = p.get("access_token") || "";
        const refresh_token = p.get("refresh_token") || "";

        if (access_token && refresh_token) {
          const res = await fetch("/api/auth/exchange-code", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              access_token,
              refresh_token,
            }),
          });

          const json = await readApiPayload(res);
          const payload = unwrapApiData(json);

          window.history.replaceState({}, "", "/update-password");

          if (!res.ok || !json?.ok) {
            throw new Error(
              payload?.error ||
                payload?.message ||
                json?.error ||
                "Ссылка недействительна или устарела. Запросите восстановление заново.",
            );
          }

          return Boolean(payload?.hasSession);
        }
      }

      return null;
    }

    async function fetchSession() {
      const res = await fetch("/api/auth/session", {
        method: "GET",
        cache: "no-store",
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) return false;

      return Boolean(payload?.authenticated);
    }

    async function run() {
      try {
        const exchanged = await exchangeRecoverySession();

        if (cancelled) return;

        const sessionExists = exchanged === true ? true : await fetchSession();

        if (cancelled) return;

        setHasSession(sessionExists);
        setReady(true);

        if (!sessionExists) {
          showBanner("warning", "ℹ️ Откройте эту страницу по ссылке из письма восстановления пароля.");
        }
      } catch (e: any) {
        if (cancelled) return;

        setReady(true);
        setHasSession(false);
        showBanner("error", "❌ " + (e?.message || "Не удалось обработать ссылку. Попробуйте запросить восстановление заново."));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !busy &&
      ready &&
      hasSession &&
      password.length >= 6 &&
      password === confirm &&
      !!captchaToken &&
      !!siteKey
    );
  }, [busy, ready, hasSession, password, confirm, captchaToken, siteKey]);

  async function onUpdate() {
    if (!ready) return;

    if (!hasSession) {
      openModal("warning", "Нет сессии восстановления", "Откройте эту страницу по ссылке из письма восстановления пароля.");
      return;
    }

    if (password.length < 6) {
      openModal("error", "Ошибка", "Пароль должен быть не менее 6 символов.");
      return;
    }

    if (password !== confirm) {
      openModal("error", "Ошибка", "Пароли не совпадают.");
      return;
    }

    if (!captchaToken) {
      openModal(
        "warning",
        "Нужна проверка",
        "Пожалуйста, пройдите проверку.\n\nЕсли проверка не отображается — нажмите «Перезагрузить проверку».",
      );
      return;
    }

    try {
      setBusy(true);
      showBanner("warning", "🔄 Обновляем пароль...");

      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, captchaToken }),
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) {
        const msg = friendlyErrorFromApi(payload || json, res.status);
        setBusy(false);
        clearBanner();
        resetCaptchaHard();
        openModal("error", "Ошибка", msg);
        return;
      }

      setBusy(false);
      clearBanner();

      openModal("success", "Пароль изменён", payload?.message || json?.message || "✅ Пароль успешно изменён! Теперь войдите в систему.");

      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      }).catch(() => null);

      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();

      openModal(
        "error",
        "Ошибка",
        "Не удалось обновить пароль.\n\nПопробуйте:\n• Перезагрузить проверку\n• Обновить страницу\n\nДетали: " +
          (e?.message || String(e)),
      );
    }
  }

  const showTopBanner = bannerType === "warning" && !!bannerText;

  return (
    <div className="page-update-password">
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="upd-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="upd-modal">
            <div className="upd-modal-header">
              <div className="upd-modal-title">
                {modalKind === "success" ? "✅ " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button type="button" className="upd-modal-close" onClick={closeModal} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <div className="upd-modal-body">{modalBody}</div>

            <div className="upd-modal-actions">
              {modalKind === "error" || modalKind === "warning" ? (
                <button
                  type="button"
                  className="btn btn-captcha-reload"
                  onClick={() => {
                    resetCaptchaHard();
                    closeModal();
                  }}
                >
                  Перезагрузить проверку
                </button>
              ) : null}

              <button type="button" className="btn btn-primary" onClick={closeModal}>
                Ок
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="upd-container">
        <div className="upd-card">
          <h2>Смена пароля</h2>

          {showTopBanner ? (
            <div className="warning" style={{ whiteSpace: "pre-line" }}>
              {bannerText}
            </div>
          ) : null}

          {!ready ? (
            <div className="warning">⏳ Проверяем ссылку...</div>
          ) : !hasSession ? (
            <div className="info-box">
              ℹ️ Чтобы сменить пароль, сначала запросите восстановление:
              <div style={{ marginTop: 10 }}>
                <Link className="btn btn-primary" href="/reset">
                  Перейти к восстановлению
                </Link>
              </div>
            </div>
          ) : (
            <>
              {!siteKey ? <div className="error-message">❌ Ключ проверки не задан. Обратитесь к администратору.</div> : null}

              <div className="form-group">
                <label htmlFor="password">Новый пароль:</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Не менее 6 символов"
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm">Повторите пароль:</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  autoComplete="new-password"
                />
              </div>

              {siteKey ? (
                <>
                  <YandexCaptchaWidget
                    siteKey={siteKey}
                    reloadNonce={reloadNonce}
                    onToken={(t) => setCaptchaToken(t)}
                  />

                  {!captchaToken ? (
                    <div className="captcha-hint">
                      🧩 <strong>Если вы не видите проверку</strong> — нажмите <strong>«Перезагрузить проверку»</strong>.
                      <br />
                      Если не помогло: обновите страницу.
                    </div>
                  ) : null}

                  <button type="button" className="btn btn-captcha-reload" disabled={false} onClick={() => resetCaptchaHard()}>
                    Перезагрузить проверку
                  </button>
                </>
              ) : null}

              <button className="btn btn-primary" disabled={!canSubmit} onClick={() => void onUpdate()}>
                {busy ? "Сохраняем..." : "Сменить пароль"}
              </button>

              <div className="link" style={{ marginTop: 16 }}>
                <p>
                  Вернуться ко входу: <Link href="/login">Войти</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}