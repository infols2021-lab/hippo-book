"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";
import {
  GATEHOUSE_LEVELS,
  type GatehouseLevelCode,
  formatGatehouseLevels,
  normalizeGatehouseLevel,
} from "@/lib/exams/levels";
import { createClientRequestNumber, getRequestStatusLabel } from "@/lib/requests/format";

export type GatehouseRequestProfile = {
  id: string;
  email: string;
  full_name: string;
  contact_phone: string;
  region: string;
};

export type GatehousePurchaseRequest = {
  id: string;
  user_id: string;
  request_number: string;
  request_date: string | null;
  created_at: string;
  updated_at: string | null;
  branch_type: "gatehouse";
  class_level: string | null;
  target_level: string[] | null;
  target_levels: string[] | null;
  textbook_types: string[] | null;
  material_kinds: string[] | null;
  email: string;
  full_name: string;
  contact_phone: string | null;
  is_processed: boolean;
  processed_at: string | null;
};

type GatehouseRequestsClientProps = {
  profile: GatehouseRequestProfile;
  initialRequests: GatehousePurchaseRequest[];
  initialError: string | null;
};

type Notice = {
  type: "success" | "error";
  text: string;
};

type FormState = {
  id: string | null;
  request_number: string;
  created_at: string;
  selectedLevel: GatehouseLevelCode | "";
};

type RequestListApiResponse = {
  ok?: boolean;
  error?: string;
  requests?: any[];
};

async function safeReadJson(res: Response) {
  const text = await res.text();

  try {
    return { text, json: text ? JSON.parse(text) : null };
  } catch {
    return { text, json: null };
  }
}

function getPaymentQRUrl(seed?: number): string {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const t = encodeURIComponent(String(seed ?? Date.now()));

  if (!supabaseUrl) return "";

  return `${supabaseUrl}/storage/v1/object/public/help-images/oplata.png?t=${t}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function formatProcessedAt(value: string | null): string {
  if (!value) return "";
  return ` · ${formatDateTime(value)}`;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toStringArray(JSON.parse(text));
      } catch {
        return [];
      }
    }

    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function getRequestLevels(request: GatehousePurchaseRequest): GatehouseLevelCode[] {
  const source =
    Array.isArray(request.target_levels) && request.target_levels.length ? request.target_levels : request.target_level;

  if (!Array.isArray(source)) return [];

  const levels: GatehouseLevelCode[] = [];

  for (const value of source) {
    const level = normalizeGatehouseLevel(value);

    if (level && !levels.includes(level)) {
      levels.push(level);
    }
  }

  return levels;
}

function getRequestMaterialLabel(request: GatehousePurchaseRequest): string {
  const kinds =
    Array.isArray(request.material_kinds) && request.material_kinds.length ? request.material_kinds : request.textbook_types;

  if (!Array.isArray(kinds) || !kinds.length) return "📝 Пробные тесты";

  const normalized = kinds.map((kind) => String(kind).trim().toLowerCase());

  if (
    normalized.includes("mock_test") ||
    normalized.includes("mock_tests") ||
    normalized.includes("mock-test") ||
    normalized.includes("mock test") ||
    normalized.includes("мок-тест") ||
    normalized.includes("мок тест") ||
    normalized.includes("пробный тест") ||
    normalized.includes("пробные тесты")
  ) {
    return "📝 Пробные тесты";
  }

  return kinds.join(", ");
}

function createInitialForm(): FormState {
  return {
    id: null,
    request_number: createClientRequestNumber({ prefix: "GA" }),
    created_at: new Date().toISOString(),
    selectedLevel: "",
  };
}

function getRequestAmount(_request?: GatehousePurchaseRequest | null): number {
  return 1000;
}

function safeDisplayName(profile: GatehouseRequestProfile): string {
  const fullName = profile.full_name.trim();
  if (fullName) return fullName;

  const email = profile.email.trim();
  if (email) return email;

  return "Не указано";
}

function normalizeRequests(rows: any[]): GatehousePurchaseRequest[] {
  return rows.map((row: any) => ({
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    request_date: typeof row?.request_date === "string" ? row.request_date : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
    branch_type: "gatehouse",
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    target_level: toStringArray(row?.target_level),
    target_levels: toStringArray(row?.target_levels),
    textbook_types: toStringArray(row?.textbook_types),
    material_kinds: toStringArray(row?.material_kinds),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    contact_phone: typeof row?.contact_phone === "string" ? row.contact_phone : null,
    is_processed: Boolean(row?.is_processed),
    processed_at: typeof row?.processed_at === "string" ? row.processed_at : null,
  }));
}

function normalizeUiErrorMessage(error: unknown, fallback = "Не удалось выполнить действие") {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : error == null ? "" : String(error);

  const msg = raw.trim();

  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("terminated")
  ) {
    return "Ошибка соединения с сервером";
  }

  return msg;
}

export default function GatehouseRequestsClient({
  profile,
  initialRequests,
  initialError,
}: GatehouseRequestsClientProps) {
  const [requests, setRequests] = useState<GatehousePurchaseRequest[]>(() => normalizeRequests(initialRequests));
  const [notice, setNotice] = useState<Notice | null>(initialError ? { type: "error", text: initialError } : null);

  const [formOpen, setFormOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [busy, setBusy] = useState(false);

  const [qrSeed, setQrSeed] = useState(Date.now());
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);

  const pendingRequests = requests.filter((request) => !request.is_processed);
  const processedRequests = requests.filter((request) => request.is_processed);
  const lastPendingRequest = pendingRequests[0] ?? null;

  function showNotice(text: string, type: Notice["type"] = "success") {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 4500);
  }

  function openPayment() {
    setQrError(false);
    setQrLoading(true);
    setQrSeed(Date.now());
    setPaymentOpen(true);
  }

  function refreshQr() {
    setQrError(false);
    setQrLoading(true);
    setQrSeed(Date.now());
  }

  async function reloadRequests() {
    try {
      const res = await fetch("/api/requests/list?branch_type=gatehouse&limit=100", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as RequestListApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRequests(Array.isArray(json.requests) ? normalizeRequests(json.requests) : []);
    } catch (error: any) {
      showNotice(`Ошибка загрузки заявок: ${normalizeUiErrorMessage(error)}`, "error");
    }
  }

  function openCreate() {
    setForm(createInitialForm());
    setFormOpen(true);
    setPaymentOpen(false);
  }

  function openEdit(request: GatehousePurchaseRequest) {
    if (request.is_processed) {
      showNotice("Обработанную заявку нельзя редактировать.", "error");
      return;
    }

    const firstLevel = getRequestLevels(request)[0] ?? "";

    setForm({
      id: request.id,
      request_number: request.request_number,
      created_at: request.created_at || new Date().toISOString(),
      selectedLevel: firstLevel,
    });

    setFormOpen(true);
    setPaymentOpen(false);
  }

  function closeForm() {
    if (busy) return;
    setFormOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    if (!form.selectedLevel) {
      showNotice("Выберите уровень Gatehouse Awards.", "error");
      return;
    }

    setBusy(true);

    const fullName = safeDisplayName(profile);

    const payload = {
      id: form.id,
      request_number: form.request_number,
      created_at: form.created_at,
      branch_type: "gatehouse",
      class_level: null,
      target_level: [form.selectedLevel],
      target_levels: [form.selectedLevel],
      textbook_types: ["mock_test"],
      material_kinds: ["mock_test"],
      email: profile.email,
      full_name: fullName,
      contact_phone: profile.contact_phone || null,
      is_processed: false,
      processed_at: null,
    };

    try {
      const res = await fetch(form.id ? "/api/requests/update" : "/api/requests/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const { json } = await safeReadJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setFormOpen(false);
      openPayment();

      if (json?.sheet?.ok === false) {
        showNotice(
          form.id
            ? "Заявка обновлена, но синк в таблицу временно не удался."
            : "Заявка создана, но запись в таблицу временно не удалась.",
          "error",
        );
      } else {
        showNotice(form.id ? "Заявка обновлена." : "Заявка создана.");
      }

      await reloadRequests();
    } catch (error: any) {
      showNotice(normalizeUiErrorMessage(error, "Не удалось сохранить заявку."), "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRequest(request: GatehousePurchaseRequest) {
    if (busy) return;

    if (request.is_processed) {
      showNotice("Обработанную заявку нельзя удалить.", "error");
      return;
    }

    const okConfirm = window.confirm(`Удалить заявку ${request.request_number}?`);
    if (!okConfirm) return;

    setBusy(true);

    try {
      const res = await fetch("/api/requests/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id: request.id }),
      });

      const { json } = await safeReadJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      if (json?.sheet?.ok === false) {
        showNotice("Заявка удалена, но строку в таблице не удалось удалить сразу.", "error");
      } else {
        showNotice("Заявка удалена.");
      }

      await reloadRequests();
    } catch (error: any) {
      showNotice(normalizeUiErrorMessage(error, "Не удалось удалить заявку."), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="gatehouse-page">
      <div className="gatehouse-container">
        <GatehouseHeader
          title="Заявки Gatehouse Awards"
          description="Создайте заявку на доступ к пробным тестам по нужному уровню. Данные профиля подтягиваются автоматически."
          backHref="/gatehouse/profile"
          backLabel="Профиль"
          actions={[
            {
              href: "/gatehouse/materials",
              label: "Материалы",
              icon: "📝",
            },
            {
              href: "/portal",
              label: "Портал",
              icon: "🏠",
            },
          ]}
        >
          <div className="gatehouse-stats" aria-label="Статистика заявок">
            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                📋
              </span>
              <span className="gatehouse-stat__value">{requests.length}</span>
              <span className="gatehouse-stat__label">всего заявок</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                ⏳
              </span>
              <span className="gatehouse-stat__value">{pendingRequests.length}</span>
              <span className="gatehouse-stat__label">ожидают обработки</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                ✅
              </span>
              <span className="gatehouse-stat__value">{processedRequests.length}</span>
              <span className="gatehouse-stat__label">обработано</span>
            </article>
          </div>
        </GatehouseHeader>

        <section className="gatehouse-profile">
          {notice ? (
            <div
              className={[
                "gatehouse-message",
                notice.type === "success" ? "gatehouse-message--success" : "gatehouse-message--error",
              ].join(" ")}
            >
              {notice.text}
            </div>
          ) : null}

          <div className="gatehouse-profile__grid">
            <section className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Новая заявка</h2>

                <p className="gatehouse-card__subtitle">
                  Сейчас в экзаменах доступен один тип материала — пробные тесты. Позже сюда можно
                  добавить новые типы без изменения формы профиля.
                </p>

                <div className="gatehouse-quick-actions">
                  <button className="gatehouse-quick-action" type="button" onClick={openCreate} disabled={busy}>
                    <span className="gatehouse-quick-action__main">
                      <span className="gatehouse-quick-action__icon" aria-hidden="true">
                        📝
                      </span>

                      <span>
                        <span className="gatehouse-quick-action__title">Создать заявку</span>
                        <span className="gatehouse-quick-action__text">
                          Выбрать уровень и запросить пробный тест
                        </span>
                      </span>
                    </span>

                    <span className="gatehouse-quick-action__arrow" aria-hidden="true">
                      →
                    </span>
                  </button>

                  {lastPendingRequest ? (
                    <button className="gatehouse-quick-action" type="button" onClick={openPayment} disabled={busy}>
                      <span className="gatehouse-quick-action__main">
                        <span className="gatehouse-quick-action__icon" aria-hidden="true">
                          💳
                        </span>

                        <span>
                          <span className="gatehouse-quick-action__title">Показать QR</span>
                          <span className="gatehouse-quick-action__text">
                            Последняя заявка: {lastPendingRequest.request_number}
                          </span>
                        </span>
                      </span>

                      <span className="gatehouse-quick-action__arrow" aria-hidden="true">
                        →
                      </span>
                    </button>
                  ) : null}
                </div>

                {formOpen ? (
                  <form className="gatehouse-form" onSubmit={handleSubmit}>
                    <div className="gatehouse-form__row">
                      <label className="gatehouse-label" htmlFor="ga-request-number">
                        Номер заявки
                      </label>

                      <input id="ga-request-number" className="gatehouse-input" value={form.request_number} readOnly disabled />
                    </div>

                    <div className="gatehouse-form__row">
                      <label className="gatehouse-label" htmlFor="ga-request-date">
                        Дата создания
                      </label>

                      <input id="ga-request-date" className="gatehouse-input" value={formatDateTime(form.created_at)} readOnly disabled />
                    </div>

                    <div className="gatehouse-form__row">
                      <label className="gatehouse-label" htmlFor="ga-request-email">
                        Email
                      </label>

                      <input id="ga-request-email" className="gatehouse-input" value={profile.email} readOnly disabled />
                    </div>

                    <div className="gatehouse-form__row">
                      <label className="gatehouse-label" htmlFor="ga-request-name">
                        ФИО
                      </label>

                      <input id="ga-request-name" className="gatehouse-input" value={safeDisplayName(profile)} readOnly disabled />
                    </div>

                    <div className="gatehouse-form__row">
                      <label className="gatehouse-label" htmlFor="ga-request-phone">
                        Телефон
                      </label>

                      <input
                        id="ga-request-phone"
                        className="gatehouse-input"
                        value={profile.contact_phone || "Не указан"}
                        readOnly
                        disabled
                      />
                    </div>

                    <div className="gatehouse-form__row">
                      <span className="gatehouse-label">Тип материала</span>
                      <div className="gatehouse-message">📝 Пробные тесты · {getRequestAmount()} ₽</div>
                    </div>

                    <div className="gatehouse-form__row">
                      <span className="gatehouse-label">Уровень</span>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {GATEHOUSE_LEVELS.map((level) => {
                          const active = form.selectedLevel === level.code;

                          return (
                            <button
                              key={level.code}
                              className={["gatehouse-button", active ? "" : "gatehouse-button--ghost"].join(" ")}
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  selectedLevel: level.code,
                                }))
                              }
                            >
                              {level.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button className="gatehouse-button" type="submit" disabled={busy}>
                        {busy ? "Сохраняем..." : form.id ? "Сохранить заявку" : "Создать заявку"}
                      </button>

                      <button className="gatehouse-button gatehouse-button--ghost" type="button" onClick={closeForm} disabled={busy}>
                        Отмена
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </section>

            <aside className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Оплата</h2>

                <p className="gatehouse-card__subtitle">
                  После создания заявки можно открыть QR-код оплаты. Администратор обработает
                  заявку и выдаст материалы по выбранному уровню.
                </p>

                {paymentOpen ? (
                  <div style={{ marginTop: 20 }}>
                    {qrUrl ? (
                      <div
                        style={{
                          overflow: "hidden",
                          borderRadius: 24,
                          border: "1px solid var(--ga-border)",
                          background: "rgba(255,255,255,0.08)",
                          padding: 14,
                          minHeight: 120,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {qrLoading ? <div style={{ fontWeight: 900, opacity: 0.85 }}>⏳ Загружаем QR...</div> : null}

                        {qrError ? (
                          <div className="gatehouse-message gatehouse-message--error" style={{ width: "100%" }}>
                            Не удалось загрузить QR-код. Нажмите “Обновить QR”.
                          </div>
                        ) : null}

                        <img
                          key={qrUrl}
                          src={qrUrl}
                          alt="QR-код оплаты"
                          onLoad={() => {
                            setQrLoading(false);
                            setQrError(false);
                          }}
                          onError={() => {
                            setQrLoading(false);
                            setQrError(true);
                          }}
                          style={{
                            display: qrLoading || qrError ? "none" : "block",
                            width: "100%",
                            maxWidth: 360,
                            margin: "0 auto",
                            borderRadius: 18,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="gatehouse-message gatehouse-message--error">Не удалось собрать ссылку на QR-код.</div>
                    )}

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <button className="gatehouse-button gatehouse-button--ghost" type="button" onClick={refreshQr}>
                        Обновить QR
                      </button>

                      <button className="gatehouse-button gatehouse-button--ghost" type="button" onClick={() => setPaymentOpen(false)}>
                        Скрыть
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="gatehouse-empty" style={{ marginTop: 20 }}>
                    <span className="gatehouse-empty__icon" aria-hidden="true">
                      💳
                    </span>

                    <h3 className="gatehouse-empty__title">QR появится после создания заявки</h3>

                    <p className="gatehouse-empty__text">Стоимость текущего типа материала: {getRequestAmount()} ₽.</p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <section className="gatehouse-card">
            <div className="gatehouse-card__inner">
              <h2 className="gatehouse-card__title">Мои заявки</h2>

              <p className="gatehouse-card__subtitle">Здесь отображаются только заявки на экзамены Gatehouse Awards.</p>

              {requests.length > 0 ? (
                <div className="gatehouse-recent">
                  {requests.map((request) => {
                    const levels = getRequestLevels(request);

                    return (
                      <article className="gatehouse-recent__item" key={request.id}>
                        <div>
                          <h3 className="gatehouse-recent__title">
                            {request.request_number} · {getRequestStatusLabel(request)}
                            {formatProcessedAt(request.processed_at)}
                          </h3>

                          <p className="gatehouse-recent__meta">
                            Gatehouse Awards · {getRequestMaterialLabel(request)} · {formatGatehouseLevels(levels)} ·{" "}
                            {formatDateTime(request.created_at)}
                          </p>

                          <p className="gatehouse-recent__meta">
                            {request.email} · {request.full_name}
                            {request.contact_phone ? ` · ${request.contact_phone}` : ""}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 8,
                          }}
                        >
                          <div className="gatehouse-recent__score">{request.is_processed ? "✅" : "⏳"}</div>

                          {!request.is_processed ? (
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                className="gatehouse-button gatehouse-button--ghost"
                                type="button"
                                onClick={() => openEdit(request)}
                                disabled={busy}
                                style={{ padding: "9px 12px", fontSize: 13 }}
                              >
                                Изменить
                              </button>

                              <button
                                className="gatehouse-button gatehouse-button--ghost"
                                type="button"
                                onClick={() => void deleteRequest(request)}
                                disabled={busy}
                                style={{ padding: "9px 12px", fontSize: 13 }}
                              >
                                Удалить
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="gatehouse-empty" style={{ marginTop: 20 }}>
                  <span className="gatehouse-empty__icon" aria-hidden="true">
                    📋
                  </span>

                  <h3 className="gatehouse-empty__title">Заявок пока нет</h3>

                  <p className="gatehouse-empty__text">Создайте заявку на пробный тест Gatehouse Awards, выбрав нужный уровень.</p>
                </div>
              )}
            </div>
          </section>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link className="gatehouse-button gatehouse-button--ghost" href="/gatehouse/profile">
              Вернуться в профиль
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}