"use client";

import "./update-password.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [busy, setBusy] = useState(false);

  // верхний баннер оставим только для "процесса"
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");

  // ✅ модалка
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
    // ✅ чтобы не залипало "Сохраняем..."
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
      return (
        (err || "Капча не пройдена или не загрузилась.") +
        "\n\nПопробуйте:\n" +
        "• Нажать «Перезагрузить капчу»\n" +
        "• Отключить VPN/прокси\n" +
        "• Обновить страницу"
      );
    }

    if (code === "NO_SESSION" || status === 401) {
      return (
        err ||
        "Сессия восстановления не найдена или устарела.\n\nЗапросите восстановление заново и перейдите по новой ссылке из письма."
      );
    }

    if (code === "VALIDATION") return err || "Проверьте пароль (не менее 6 символов).";

    if (err) return err;

    return `Не удалось обновить пароль (${status}). Попробуйте перезагрузить капчу и повторить.`;
  }

  // 1) подхват recovery-сессии из ссылки
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          window.history.replaceState({}, "", "/update-password");
          if (error && !cancelled) {
            showBanner("error", "❌ Ссылка недействительна или устарела. Запросите восстановление заново.");
          }
        } else {
          const hash = window.location.hash || "";
          if (hash.includes("access_token=") && hash.includes("refresh_token=")) {
            const p = new URLSearchParams(hash.replace(/^#/, ""));
            const access_token = p.get("access_token") || "";
            const refresh_token = p.get("refresh_token") || "";
            if (access_token && refresh_token) {
              const { error } = await supabase.auth.setSession({ access_token, refresh_token });
              window.history.replaceState({}, "", "/update-password");
              if (error && !cancelled) {
                showBanner("error", "❌ Ссылка недействительна или устарела. Запросите восстановление заново.");
              }
            }
          }
        }

        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        setHasSession(!!data.session);
        setReady(true);

        if (!data.session) {
          showBanner("warning", "ℹ️ Откройте эту страницу по ссылке из письма восстановления пароля.");
        }
      } catch {
        if (cancelled) return;
        setReady(true);
        setHasSession(false);
        showBanner("error", "❌ Не удалось обработать ссылку. Попробуйте запросить восстановление заново.");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
        "Нужна капча",
        "Пожалуйста, пройдите капчу.\n\nЕсли капча не отображается — нажмите «Перезагрузить капчу»."
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

      // ✅ читаем даже при 400
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = friendlyErrorFromApi(json, res.status);
        setBusy(false);
        clearBanner();
        resetCaptchaHard();
        openModal("error", "Ошибка", msg);
        return;
      }

      if (!json?.ok) {
        const msg = friendlyErrorFromApi(json, 400);
        setBusy(false);
        clearBanner();
        resetCaptchaHard();
        openModal("error", "Ошибка", msg);
        return;
      }

      setBusy(false);
      clearBanner();

      openModal("success", "Пароль изменён", json.message || "✅ Пароль успешно изменён! Теперь войдите в систему.");

      // закрываем recovery-сессию
      await supabase.auth.signOut();

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
        "Не удалось обновить пароль.\n\nПопробуйте:\n• Перезагрузить капчу\n• Обновить страницу\n• Отключить VPN/прокси\n\nДетали: " +
          (e?.message || String(e))
      );
    }
  }

  const showTopBanner = bannerType === "warning" && !!bannerText;

  return (
    <div className="page-update-password">
      {/* ✅ MODAL */}
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
              {(modalKind === "error" || modalKind === "warning") ? (
                <button
                  type="button"
                  className="btn btn-captcha-reload"
                  onClick={() => {
                    resetCaptchaHard();
                    closeModal();
                  }}
                >
                  Перезагрузить капчу
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
              {!siteKey ? <div className="error-message">❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY не задан</div> : null}

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
                  <TurnstileWidget
                    siteKey={siteKey}
                    action="update_password"
                    reloadNonce={reloadNonce}
                    onToken={(t) => setCaptchaToken(t)}
                  />

                  {/* ✅ Подсказка, если капча не прогрузилась / токена нет */}
                  {!captchaToken ? (
                    <div className="captcha-hint">
                      🧩 <strong>Если вы не видите капчу</strong> — нажмите{" "}
                      <strong>«Перезагрузить капчу»</strong>.
                      <br />
                      Если не помогло: отключите VPN/прокси и обновите страницу.
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-captcha-reload"
                    // ✅ как просил: всегда можно нажать
                    disabled={false}
                    onClick={() => resetCaptchaHard()}
                  >
                    Перезагрузить капчу
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
