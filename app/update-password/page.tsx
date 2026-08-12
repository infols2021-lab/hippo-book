"use client";

import "./update-password.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

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
    return { ok: false, error: text };
  }
}

function unwrapApiData(json: ApiPayload | null) {
  if (!json) return null;
  if (json.data && typeof json.data === "object") return json.data;
  return json;
}

export default function UpdatePasswordPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

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
      err.toLowerCase().includes("капч")
    ) {
      return "Проверка безопасности не пройдена.\n\nПопробуйте перезагрузить капчу или отключить VPN.";
    }

    if (code === "NO_SESSION" || code === "UNAUTHORIZED" || status === 401) {
      return err || "Сеанс восстановления не найден или истек.\nПожалуйста, запросите восстановление заново.";
    }

    if (code === "INVALID_OR_EXPIRED_LINK") {
      return err || "Ссылка недействительна или устарела. Запросите восстановление заново.";
    }

    if (code === "VALIDATION") return err || "Проверьте введенный пароль (не менее 6 символов).";

    if (err) return err;

    return `Не удалось обновить пароль (Код: ${status}). Попробуйте перезагрузить страницу.`;
  }

  useEffect(() => {
    let cancelled = false;

    async function exchangeRecoverySession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const res = await fetch("/api/auth/exchange-code", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });

        const json = await readApiPayload(res);
        const payload = unwrapApiData(json);

        window.history.replaceState({}, "", "/update-password");

        if (!res.ok || !json?.ok) {
          throw new Error(
            payload?.error || payload?.message || json?.error || "Ссылка недействительна. Запросите восстановление заново."
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
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ access_token, refresh_token }),
          });

          const json = await readApiPayload(res);
          const payload = unwrapApiData(json);

          window.history.replaceState({}, "", "/update-password");

          if (!res.ok || !json?.ok) {
            throw new Error(
              payload?.error || payload?.message || json?.error || "Ссылка недействительна. Запросите восстановление заново."
            );
          }
          return Boolean(payload?.hasSession);
        }
      }
      return null;
    }

    async function fetchSession() {
      const res = await fetch("/api/auth/session", { method: "GET", cache: "no-store" });
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
          showBanner("warning", "Пожалуйста, откройте эту страницу по ссылке из письма для восстановления.");
        }
      } catch (e: any) {
        if (cancelled) return;
        setReady(true);
        setHasSession(false);
        showBanner("error", "Ошибка: " + (e?.message || "Не удалось обработать ссылку."));
      }
    }

    run();
    return () => { cancelled = true; };
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
      openModal("warning", "Нет доступа", "Откройте эту страницу по актуальной ссылке из письма восстановления.");
      return;
    }

    if (password.length < 6) {
      openModal("error", "Ошибка", "Пароль должен состоять минимум из 6 символов.");
      return;
    }

    if (password !== confirm) {
      openModal("error", "Ошибка", "Введенные пароли не совпадают.");
      return;
    }

    if (!captchaToken) {
      openModal("warning", "Необходима проверка", "Пожалуйста, пройдите проверку безопасности.");
      return;
    }

    try {
      setBusy(true);
      showBanner("warning", "Сохраняем новый пароль...");

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
        openModal("error", "Ошибка обновления", msg);
        return;
      }

      setBusy(false);
      clearBanner();

      openModal("success", "Пароль изменён", payload?.message || json?.message || "Ваш пароль успешно обновлен. Сейчас вы будете перенаправлены на страницу входа.");

      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => null);

      setTimeout(() => {
        window.location.href = "/login";
      }, 2500);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();
      openModal("error", "Сбой", "Произошла системная ошибка.\nДетали: " + (e?.message || String(e)));
    }
  }

  const showTopBanner = bannerType !== null && !!bannerText;

  return (
    <div className="page-update-password">
      {modalOpen ? (
        <div className="modal-notice-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-notice">
            <div className="modal-notice-head">
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>
                {modalKind === "success" ? "🎉 " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button type="button" onClick={closeModal} className="modal-notice-x">✕</button>
            </div>
            <div className="modal-notice-body">{modalBody}</div>
            <div className="modal-notice-actions">
              {modalKind === "error" || modalKind === "warning" ? (
                <button type="button" className="btn btn-secondary" onClick={() => { resetCaptchaHard(); closeModal(); }}>
                  Перезагрузить капчу
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={closeModal} style={{ width: "auto", marginTop: 0 }}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="upd-container">
        <div className="upd-card">
          
          <div className="brand">
            <div className="brand-mark">EK</div>
            <div>
              <div className="brand-title">skilLS</div>
              <div className="brand-subtitle">Создание нового пароля</div>
            </div>
          </div>

          <div className="progress-bar">
            <div className="progress-step active" />
            <div className={`progress-step ${ready && hasSession ? "active" : ""}`} />
          </div>

          <h2 className="step-title">
            {!ready ? "Проверка ссылки..." : !hasSession ? "Доступ ограничен" : "Шаг 2. Новый пароль"}
          </h2>

          {showTopBanner ? (
            <div className={`banner ${bannerType}`} style={{ whiteSpace: "pre-line" }}>
              {bannerText}
            </div>
          ) : null}

          {!ready ? (
            <div className="info-box">Проверка защищенного соединения...</div>
          ) : !hasSession ? (
            <div className="info-box">
              <strong>Доступ ограничен.</strong><br />Для смены пароля необходимо использовать персональную ссылку из электронного письма.
              <div style={{ marginTop: 14 }}>
                <Link className="btn btn-primary" href="/reset">
                  Запросить ссылку
                </Link>
              </div>
            </div>
          ) : (
            <>
              {!siteKey ? <div className="banner error-message">Отсутствует конфигурация безопасности</div> : null}

              <div className="form-group">
                <label htmlFor="password">Новый пароль</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm">Повторите пароль</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Введите пароль еще раз"
                  autoComplete="new-password"
                />
                {confirm && password !== confirm && (
                  <div className="field-error">Введенные пароли не совпадают</div>
                )}
              </div>

              {siteKey ? (
                <>
                  <div className="captcha-wrapper">
                    <TurnstileWidget
                      siteKey={siteKey}
                      action="update_password"
                      reloadNonce={reloadNonce}
                      onToken={(t) => setCaptchaToken(t)}
                    />
                  </div>

                  {!captchaToken ? (
                    <div className="rate-limit">
                      Не отображается проверка? Нажмите «Перезагрузить капчу».
                    </div>
                  ) : null}

                  <button type="button" className="btn btn-captcha-reload" disabled={false} onClick={() => resetCaptchaHard()}>
                    Перезагрузить капчу
                  </button>
                </>
              ) : null}

              <button className="btn btn-primary" disabled={!canSubmit} onClick={() => void onUpdate()}>
                {busy ? "Сохранение..." : "Подтвердить смену"}
              </button>

              <div className="link">
                <Link href="/login">Отменить и вернуться ко входу</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}