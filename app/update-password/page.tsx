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
          showBanner("warning", "Пожалуйста, откройте эту страницу по актуальной ссылке из письма для восстановления.");
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
            <div className="modal-notice-head flex items-center gap-3 border-b border-slate-100 pb-3 mb-2">
              {modalKind === "success" && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {modalKind === "error" && (
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              {modalKind === "warning" && (
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              <div className="font-black text-lg text-slate-900 tracking-tight">{modalTitle}</div>
              <button type="button" onClick={closeModal} className="ml-auto text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="modal-notice-body text-slate-500 font-medium text-[14px] leading-relaxed whitespace-pre-wrap py-2">
              {modalBody}
            </div>
            <div className="modal-notice-actions mt-4 pt-4 border-t border-slate-50 flex gap-3 justify-end">
              {modalKind === "error" || modalKind === "warning" ? (
                <button type="button" className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-[13px]" onClick={() => { resetCaptchaHard(); closeModal(); }}>
                  Перезагрузить капчу
                </button>
              ) : null}
              <button type="button" className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-colors text-[13px]" onClick={closeModal}>
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
            {!ready ? "Проверка ссылки" : !hasSession ? "Доступ ограничен" : "Шаг 2. Новый пароль"}
          </h2>

          {showTopBanner ? (
            <div className={`banner ${bannerType} whitespace-pre-line`}>
              {bannerText}
            </div>
          ) : null}

          {!ready ? (
            <div className="flex flex-col items-center justify-center py-10 animate-pulse">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-medium text-[14px]">Устанавливаем защищенное соединение...</p>
            </div>
          ) : !hasSession ? (
            <div className="mt-6 p-[2px] rounded-[24px] bg-gradient-to-br from-rose-400 via-orange-400 to-rose-500 shadow-lg shadow-rose-200/50 w-full text-center">
              <div className="bg-white rounded-[22px] p-8 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-rose-500/10 blur-xl rounded-full pointer-events-none" />
                
                <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-100 shadow-sm">
                  <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>

                <h3 className="relative text-[18px] font-black text-slate-900 mb-2 tracking-tight">Ссылка устарела</h3>
                <p className="relative text-[14px] text-slate-500 font-medium leading-relaxed mb-6">
                  По соображениям безопасности ссылки для сброса пароля живут ограниченное время. Эта ссылка больше не работает.
                </p>

                <Link href="/reset" className="inline-flex items-center justify-center w-full px-6 py-3 bg-slate-900 hover:bg-black text-white text-[14px] font-bold rounded-xl transition-all shadow-md">
                  Запросить новую ссылку
                </Link>
              </div>
            </div>
          ) : (
            <div className="animate-step">
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
                  <div className="text-[12px] font-semibold text-rose-500 mt-1.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Пароли не совпадают
                  </div>
                )}
              </div>

              {siteKey ? (
                <div className="mt-2 mb-6">
                  <div className="captcha-wrapper">
                    <TurnstileWidget
                      siteKey={siteKey}
                      action="update_password"
                      reloadNonce={reloadNonce}
                      onToken={(t) => setCaptchaToken(t)}
                    />
                  </div>

                  {!captchaToken ? (
                    <div className="text-[13px] text-slate-500 font-medium mb-3">
                      Не отображается проверка? Нажмите «Перезагрузить капчу».
                    </div>
                  ) : null}

                  <button type="button" className="btn btn-captcha-reload" disabled={false} onClick={() => resetCaptchaHard()}>
                    Перезагрузить капчу
                  </button>
                </div>
              ) : null}

              <button className="btn btn-primary w-full" disabled={!canSubmit} onClick={() => void onUpdate()}>
                {busy ? "Сохранение..." : "Подтвердить смену"}
              </button>

              <div className="link mt-6">
                <Link href="/login" className="text-slate-500 hover:text-slate-800 font-semibold transition-colors">
                  Отменить и вернуться ко входу
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}