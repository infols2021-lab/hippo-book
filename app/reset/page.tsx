"use client";

import "./reset.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { isValidEmailFormat, validateEmailDomain } from "@/lib/security/domains";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

export default function ResetPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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

  const canSubmit = useMemo(() => {
    const e = email.trim().toLowerCase();
    return !!siteKey && !busy && !sent && isValidEmailFormat(e) && !!captchaToken;
  }, [siteKey, busy, sent, email, captchaToken]);

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

    if (code === "VALIDATION") return err || "Проверьте правильность email.";
    if (status === 429 || code === "RATE_LIMIT") return "Слишком много попыток. Попробуйте позже.";

    if (err) return err;
    return `Не удалось отправить письмо (${status}). Попробуйте перезагрузить капчу и повторить.`;
  }

  async function onSend() {
    const e = email.trim().toLowerCase();

    if (!e) {
      openModal("error", "Ошибка", "Введите email.");
      return;
    }
    if (!isValidEmailFormat(e)) {
      openModal("error", "Ошибка", "Неверный формат email.");
      return;
    }

    const d = validateEmailDomain(e);
    if (!d.ok) {
      openModal("error", "Ошибка", d.message);
      return;
    }

    if (!captchaToken) {
      openModal(
        "warning",
        "Нужна капча",
        "Пожалуйста, пройдите капчу.\n\nЕсли капча не отображается — нажмите «Перезагрузить капчу».",
      );
      return;
    }

    try {
      setBusy(true);
      showBanner("warning", "📧 Отправляем письмо для восстановления...");

      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e, captchaToken }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        const msg = friendlyErrorFromApi(json, res.status);

        setBusy(false);
        clearBanner();
        resetCaptchaHard();

        openModal("error", "Ошибка", msg);
        return;
      }

      setBusy(false);
      clearBanner();
      setSent(true);

      openModal(
        "success",
        "Готово!",
        json.message ||
          "✅ Если такой email существует, мы отправили письмо со ссылкой для смены пароля.\n\nПроверьте «Входящие» и «Спам».",
      );

      setCaptchaToken(null);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();

      openModal(
        "error",
        "Ошибка",
        "Не удалось отправить запрос.\n\nПопробуйте:\n• Перезагрузить капчу\n• Обновить страницу\n• Отключить VPN/прокси\n\nДетали: " +
          (e?.message || String(e)),
      );
    }
  }

  const showTopBanner = bannerType === "warning" && !!bannerText;

  return (
    <div className="page-reset">
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="reset-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="reset-modal">
            <div className="reset-modal-header">
              <div className="reset-modal-title">
                {modalKind === "success" ? "✅ " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button type="button" className="reset-modal-close" onClick={closeModal} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <div className="reset-modal-body">{modalBody}</div>

            <div className="reset-modal-actions">
              {modalKind === "error" || modalKind === "warning" ? (
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

      <div className="reset-container">
        <div className="reset-card">
          <h2>Восстановление пароля</h2>

          {showTopBanner ? (
            <div className="warning" style={{ whiteSpace: "pre-line" }}>
              {bannerText}
            </div>
          ) : null}

          <div className="info-box">
            🔒 Мы отправим письмо со ссылкой. <strong>Пароль меняется только после перехода по ссылке из письма.</strong>
            <br />
            Проверьте также папку <strong>Спам</strong>.
          </div>

          {!siteKey ? <div className="error-message">❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY не задан</div> : null}

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="example@gmail.com"
              autoComplete="email"
            />
          </div>

          {siteKey ? (
            <>
              <TurnstileWidget
                siteKey={siteKey}
                action="reset_request"
                reloadNonce={reloadNonce}
                onToken={(t) => setCaptchaToken(t)}
              />

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
                disabled={false}
                onClick={() => resetCaptchaHard()}
              >
                Перезагрузить капчу
              </button>
            </>
          ) : null}

          <button className="btn btn-primary" disabled={!canSubmit} onClick={() => void onSend()}>
            {busy ? "Отправляем..." : sent ? "Письмо отправлено" : "Отправить письмо"}
          </button>

          <div className="link">
            <p>
              Вспомнили пароль? <Link href="/login">Вернуться ко входу</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}