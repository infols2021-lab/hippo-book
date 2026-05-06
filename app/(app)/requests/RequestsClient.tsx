"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import Modal from "@/components/Modal";

type PurchaseRequest = {
  id: string;
  request_number: string;
  request_date?: string | null;
  created_at: string;
  updated_at?: string | null;
  class_level: string | null;
  textbook_types: string[] | null;
  material_kinds?: string[] | null;
  email: string;
  full_name: string;
  contact_phone?: string | null;
  is_processed: boolean;
  processed_at?: string | null;
  user_id: string;
  branch_type?: string | null;
};

type Props = {
  userId: string;
  userEmail: string;
  userFullName: string;
  initialRequests: PurchaseRequest[];
};

type RequestListApiResponse = {
  ok?: boolean;
  error?: string;
  requests?: any[];
};

function generateRequestNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `PR-${year}${month}${day}-${random}`;
}

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
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

  const single = normalizeString(value);
  return single ? [single] : [];
}

function normalizeBranchType(value: unknown) {
  const raw = normalizeString(value).toLowerCase();

  if (
    raw === "gatehouse" ||
    raw === "gatehouse_awards" ||
    raw === "ga" ||
    raw === "ga_exam" ||
    raw === "exam" ||
    raw === "exams"
  ) {
    return "gatehouse";
  }

  return "olympiad";
}

function normalizeMaterialType(value: unknown) {
  const raw = normalizeString(value).toLowerCase();

  if (raw === "учебник" || raw === "textbook") return "textbook";
  if (raw === "кроссворд" || raw === "crossword") return "crossword";

  return raw;
}

function getRequestMaterialTypes(request: Pick<PurchaseRequest, "textbook_types" | "material_kinds">) {
  const materialKinds = toStringArray(request.material_kinds).map(normalizeMaterialType).filter(Boolean);
  if (materialKinds.length) return Array.from(new Set(materialKinds));

  const legacyKinds = toStringArray(request.textbook_types).map(normalizeMaterialType).filter(Boolean);
  return Array.from(new Set(legacyKinds));
}

function hasMaterialType(request: Pick<PurchaseRequest, "textbook_types" | "material_kinds">, type: "textbook" | "crossword") {
  return getRequestMaterialTypes(request).includes(type);
}

function formatClassLevel(classLevel: string | null) {
  if (!classLevel) return "—";

  const classMap: Record<string, string> = {
    "1-2": "1-2 класс",
    "3-4": "3-4 класс",
    "5-6": "5-6 класс",
    "7": "7 класс",
    "8-9": "8-9 класс",
    "10-11": "10-11 класс (Техникум, колледж - 1й курс)",
    "12": "12 класс (Техникум, колледж)",
  };

  return classMap[classLevel] || classLevel;
}

function formatTextbookTypes(request: Pick<PurchaseRequest, "textbook_types" | "material_kinds">) {
  const types = getRequestMaterialTypes(request);

  if (!types.length) return "";

  const typeMap: Record<string, string> = {
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
  };

  return types.map((type) => typeMap[type] || type).join(", ");
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return "—";

  const d = new Date(dateString);

  if (Number.isNaN(d.getTime())) return String(dateString);

  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcAmountFromRequest(request: Pick<PurchaseRequest, "textbook_types" | "material_kinds"> | null) {
  if (!request) return 0;
  return getRequestMaterialTypes(request).length * 1000;
}

function getPaymentQRUrl(seed?: number) {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const t = encodeURIComponent(String(seed ?? Date.now()));

  if (!supabaseUrl) return "";

  return `${supabaseUrl}/storage/v1/object/public/help-images/oplata.png?t=${t}`;
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { text, json };
}

function normalizeRequestRow(row: any): PurchaseRequest {
  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    request_date: typeof row?.request_date === "string" ? row.request_date : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
    branch_type: normalizeBranchType(row?.branch_type),
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    textbook_types: toStringArray(row?.textbook_types),
    material_kinds: toStringArray(row?.material_kinds),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    contact_phone: typeof row?.contact_phone === "string" ? row.contact_phone : null,
    is_processed: Boolean(row?.is_processed),
    processed_at: typeof row?.processed_at === "string" ? row.processed_at : null,
  };
}

function normalizeRequests(rows: any[]): PurchaseRequest[] {
  return rows.map(normalizeRequestRow);
}

function extractRequestFromApi(json: any): PurchaseRequest | null {
  const candidates = [json?.request, json?.data?.request, json?.data, json?.purchaseRequest];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && typeof candidate.id === "string") {
      return normalizeRequestRow(candidate);
    }
  }

  return null;
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

export default function RequestsClient({ userId, userEmail, userFullName, initialRequests }: Props) {
  const [requests, setRequests] = useState<PurchaseRequest[]>(() => normalizeRequests(initialRequests));
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [requestNumber, setRequestNumber] = useState("");
  const [requestDateTime, setRequestDateTime] = useState("");
  const [classLevel, setClassLevel] = useState("");

  const [typeTextbook, setTypeTextbook] = useState(false);
  const [typeCrossword, setTypeCrossword] = useState(false);

  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);

  const [qrSeed, setQrSeed] = useState<number>(() => Date.now());
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const [busy, setBusy] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);

  useEffect(() => {
    setRequests(normalizeRequests(initialRequests));
  }, [initialRequests]);

  function openPaymentModal(amount: number) {
    setPaymentTotalAmount(amount);
    setQrLoading(true);
    setQrError(false);
    setQrSeed(Date.now());
    setPaymentModalOpen(true);
  }

  function resetQrStateAndRefresh() {
    setQrError(false);
    setQrLoading(true);
    setQrSeed(Date.now());
  }

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  }

  async function reloadRequests() {
    try {
      const res = await fetch("/api/requests/list?branch_type=olympiad&limit=100", {
        method: "GET",
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as RequestListApiResponse | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRequests(Array.isArray(json.requests) ? normalizeRequests(json.requests) : []);
    } catch (error) {
      showNotification(`Ошибка загрузки заявок: ${normalizeUiErrorMessage(error)}`, "error");
    }
  }

  function totalTypesSelected() {
    return (typeTextbook ? 1 : 0) + (typeCrossword ? 1 : 0);
  }

  function selectedTypesArray() {
    const arr: string[] = [];

    if (typeTextbook) arr.push("textbook");
    if (typeCrossword) arr.push("crossword");

    return arr;
  }

  const lastPendingRequest = useMemo(() => {
    return requests.find((r) => !r.is_processed && normalizeBranchType(r.branch_type) === "olympiad") ?? null;
  }, [requests]);

  const lastPendingAmount = useMemo(() => {
    return lastPendingRequest ? calcAmountFromRequest(lastPendingRequest) : 0;
  }, [lastPendingRequest]);

  function openCreate() {
    setEditingId(null);
    setRequestNumber(generateRequestNumber());

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);

    setRequestDateTime(localISO);
    setClassLevel("");
    setTypeTextbook(false);
    setTypeCrossword(false);
    setRequestModalOpen(true);
  }

  function openEdit(r: PurchaseRequest) {
    if (r.is_processed) {
      showNotification("🔒 Обработанную заявку нельзя редактировать", "error");
      return;
    }

    setEditingId(r.id);
    setRequestNumber(r.request_number);

    const d = new Date(r.created_at || new Date().toISOString());
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setRequestDateTime(localISO);
    setClassLevel(r.class_level || "");

    setTypeTextbook(hasMaterialType(r, "textbook"));
    setTypeCrossword(hasMaterialType(r, "crossword"));

    setRequestModalOpen(true);
  }

  async function saveRequest() {
    if (busy) return;

    if (!requestDateTime || !classLevel) {
      showNotification("❌ Пожалуйста, заполните все обязательные поля", "error");
      return;
    }

    const types = selectedTypesArray();

    if (types.length === 0) {
      showNotification("❌ Пожалуйста, выберите хотя бы один тип материала", "error");
      return;
    }

    if (editingId) {
      const cur = requests.find((x) => x.id === editingId);

      if (cur?.is_processed) {
        showNotification("🔒 Обработанную заявку нельзя редактировать", "error");
        setRequestModalOpen(false);
        return;
      }
    }

    const payload = {
      request_number: requestNumber,
      created_at: requestDateTime + ":00Z",
      branch_type: "olympiad",
      class_level: classLevel,
      textbook_types: types,
      material_kinds: types,
      email: userEmail,
      full_name: userFullName,
      user_id: userId,
      is_processed: false,
    };

    setBusy(true);

    try {
      if (editingId) {
        const res = await fetch("/api/requests/update", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            id: editingId,
            request_number: payload.request_number,
            created_at: payload.created_at,
            branch_type: payload.branch_type,
            class_level: payload.class_level,
            textbook_types: payload.textbook_types,
            material_kinds: payload.material_kinds,
            email: payload.email,
            full_name: payload.full_name,
          }),
        });

        const { json } = await safeReadJson(res);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `HTTP ${res.status}`);
        }

        const updated = extractRequestFromApi(json);

        setRequests((prev) => {
          return prev.map((item) => {
            if (item.id !== editingId) return item;

            return normalizeRequestRow({
              ...item,
              ...(updated ?? {}),
              request_number: payload.request_number,
              branch_type: payload.branch_type,
              class_level: payload.class_level,
              textbook_types: payload.textbook_types,
              material_kinds: payload.material_kinds,
              email: payload.email,
              full_name: payload.full_name,
            });
          });
        });

        setRequestModalOpen(false);
        showNotification("✅ Заявка успешно обновлена");

        if (json?.sheet?.ok === false) {
          showNotification(
            "⚠️ Заявка обновлена, но синк в таблицу временно не удался. Админ досинхронизирует позже.",
            "error",
          );
        }

        openPaymentModal(types.length * 1000);
        await reloadRequests();
        return;
      }

      const res = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          request_number: payload.request_number,
          created_at: payload.created_at,
          branch_type: payload.branch_type,
          class_level: payload.class_level,
          textbook_types: payload.textbook_types,
          material_kinds: payload.material_kinds,
          email: payload.email,
          full_name: payload.full_name,
        }),
      });

      const { json } = await safeReadJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      const created = extractRequestFromApi(json);

      if (created) {
        setRequests((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
      }

      setRequestModalOpen(false);

      const totalAmount = types.length * 1000;
      openPaymentModal(totalAmount);

      if (json?.sheet?.ok === false) {
        showNotification(
          "⚠️ Заявка создана, но запись в таблицу временно не удалась. Админ досинхронизирует позже.",
          "error",
        );
      } else {
        showNotification("✅ Заявка успешно создана");
      }

      await reloadRequests();
    } catch (e: any) {
      showNotification("❌ Ошибка при сохранении заявки: " + normalizeUiErrorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRequest(r: PurchaseRequest) {
    if (busy) return;

    if (r.user_id !== userId) {
      showNotification("❌ Вы можете удалять только свои заявки", "error");
      return;
    }

    if (r.is_processed) {
      showNotification("🔒 Обработанную заявку нельзя удалить", "error");
      return;
    }

    const okConfirm = window.confirm(`Вы уверены, что хотите удалить заявку ${r.request_number}?`);
    if (!okConfirm) return;

    setBusy(true);

    try {
      const res = await fetch("/api/requests/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id: r.id }),
      });

      const { json } = await safeReadJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRequests((prev) => prev.filter((item) => item.id !== r.id));

      if (json?.sheet?.ok === false) {
        showNotification(
          "⚠️ Заявка удалена, но строку в таблице не удалось удалить сразу — админский синк подчистит.",
          "error",
        );
      } else {
        showNotification("✅ Заявка успешно удалена");
      }

      await reloadRequests();
    } catch (e: any) {
      showNotification("Ошибка при удалении заявки: " + normalizeUiErrorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const totalAmount = totalTypesSelected() * 1000;

  return (
    <div className="page-requests">
      {notif ? <div className={`notification ${notif.type === "error" ? "error" : ""}`}>{notif.text}</div> : null}

      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title={editingId ? "Редактировать заявку" : "Создать заявку"}
        maxWidth={520}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveRequest();
          }}
        >
          <div className="form-group">
            <label>Номер заявки:</label>
            <input type="text" value={requestNumber} readOnly />
          </div>

          <div className="form-group">
            <label>Дата и время создания:</label>
            <input type="datetime-local" value={requestDateTime} readOnly />
          </div>

          <div className="form-group">
            <label>Класс:</label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} required>
              <option value="">-- Выберите класс --</option>
              <option value="1-2">1) 1-2 класс</option>
              <option value="3-4">2) 3-4 класс</option>
              <option value="5-6">3) 5-6 класс</option>
              <option value="7">4) 7 класс</option>
              <option value="8-9">5) 8-9 класс</option>
              <option value="10-11">6) 10-11 класс (Техникум, колледж - 1й курс)</option>
              <option value="12">7) 12 класс (Техникум, колледж)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Тип учебника (стоимость каждого материала 1000р):</label>

            <div className="checkbox-group">
              <div
                className={`checkbox-item ${typeTextbook ? "checked" : ""}`}
                onClick={() => setTypeTextbook((v) => !v)}
              >
                <input type="checkbox" checked={typeTextbook} readOnly />
                <label>
                  Учебник <span className="price-info">(1000р)</span>
                </label>
              </div>

              <div
                className={`checkbox-item ${typeCrossword ? "checked" : ""}`}
                onClick={() => setTypeCrossword((v) => !v)}
              >
                <input type="checkbox" checked={typeCrossword} readOnly />
                <label>
                  Кроссворд <span className="price-info">(1000р)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input type="email" value={userEmail} readOnly />
          </div>

          <div className="form-group">
            <label>ФИО ученика:</label>
            <input type="text" value={userFullName} readOnly />
          </div>

          <div className="total-amount" style={{ display: totalAmount > 0 ? "block" : "none" }}>
            <h4>💰 Общая сумма к оплате:</h4>
            <div className="amount">{totalAmount} руб.</div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={() => setRequestModalOpen(false)} disabled={busy}>
              ❌ Отмена
            </button>

            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Сохраняем..." : "💾 Сохранить заявку"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="✅ Заявка" maxWidth={520}>
        <div className="success-message">
          <h4>📋 Информация</h4>
          <p>
            <strong>Доступ к выбранным материалам будет открыт после подтверждения оплаты.</strong>
          </p>
          <p>Оплатить можно по QR-коду ниже.</p>
        </div>

        {paymentTotalAmount > 0 ? (
          <div className="total-amount">
            <h4>💰 Сумма к оплате:</h4>
            <div className="amount">{paymentTotalAmount} руб.</div>
            <p className="small-muted" style={{ marginTop: 8 }}>
              В платеже обязательно укажите ФИО, а в назначении платежа — «за учебные пособия».
            </p>
          </div>
        ) : (
          <div className="small-muted" style={{ marginTop: 8 }}>
            {lastPendingRequest
              ? "Сумма к оплате не определена."
              : "Нет необработанных заявок — сумма зависит от вашей последней созданной заявки."}
          </div>
        )}

        <div className="qr-head">
          <div className="qr-title">QR-код для оплаты</div>

          <button type="button" className="qr-refresh" onClick={resetQrStateAndRefresh} title="Обновить QR" aria-label="Обновить QR">
            ↻
          </button>
        </div>

        <div className="payment-qr payment-qr--smart">
          {qrLoading ? (
            <div className="qr-loader" role="status" aria-live="polite">
              <span className="qr-spinner" />
              <div className="qr-loader-text">Загружаю QR-код…</div>
            </div>
          ) : null}

          {qrError ? (
            <div className="qr-error" role="alert">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Не удалось загрузить QR-код</div>
              <div className="small-muted" style={{ marginBottom: 10 }}>
                Нажмите “↻”, чтобы обновить и попробовать снова.
              </div>

              <button type="button" className="btn" onClick={resetQrStateAndRefresh}>
                ↻ Обновить QR
              </button>
            </div>
          ) : null}

          <img
            key={qrUrl}
            src={qrUrl}
            alt=""
            aria-hidden="true"
            className={`qr-img ${qrLoading || qrError ? "is-hidden" : ""}`}
            onLoad={() => {
              setQrLoading(false);
              setQrError(false);
            }}
            onError={() => {
              setQrLoading(false);
              setQrError(true);
            }}
          />
        </div>

        <div style={{ textAlign: "center", marginTop: 15 }}>
          <p className="small-muted">После оплаты доступ к материалам будет открыт в течение 24 часов</p>
        </div>

        <div className="modal-actions">
          <button className="btn" type="button" onClick={() => setPaymentModalOpen(false)}>
            Понятно
          </button>
        </div>
      </Modal>

      <div className="container">
        <AppHeader
          nav={[
            { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
            { kind: "link", href: "/profile", label: "👤 Профиль", className: "btn" },
            { kind: "link", href: "/portal", label: "🏠 Портал", className: "btn secondary" },
            { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
          ]}
        />

        <div className="card">
          <h2 style={{ color: "var(--accent2)", marginBottom: 20 }}>📝 Мои заявки на учебники</h2>

          <div className="payment-info">
            <h4>💰 Информация об оплате</h4>
            <p>
              Стоимость каждого учебника или кроссворда — 1000 рублей. QR-код для оплаты появляется сразу после создания заявки.
              Также его можно увидеть на этой странице, нажав кнопку "Показать qr". После подтверждения оплаты доступ к материалам
              будет открыт в течение 24 часов.
            </p>
          </div>

          <div className="requests-actions">
            <button className="btn" onClick={openCreate} type="button" disabled={busy}>
              ➕ Создать новую заявку
            </button>

            <button
              className="btn ghost qr-open"
              type="button"
              onClick={() => {
                const amount = lastPendingAmount;

                openPaymentModal(amount);

                if (!lastPendingRequest) {
                  showNotification("ℹ️ Не найдено необработанных заявок. Если вы уже оплатили — дождитесь подтверждения.", "error");
                }
              }}
              title="Показать QR"
            >
              📷 Показать qr
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>📭 Заявок пока нет</h3>
              <p>Создайте свою первую заявку на покупку учебников или кроссвордов</p>

              <button className="btn" onClick={openCreate} type="button" disabled={busy}>
                ➕ Создать заявку
              </button>
            </div>
          ) : (
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Номер заявки</th>
                  <th>Дата и время создания</th>
                  <th>Класс</th>
                  <th>Типы материалов</th>
                  <th>Email</th>
                  <th>ФИО ученика</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>

              <tbody>
                {requests.map((r) => {
                  const locked = r.is_processed;

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.request_number}</strong>
                      </td>

                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{formatClassLevel(r.class_level)}</td>
                      <td>{formatTextbookTypes(r)}</td>
                      <td>{r.email}</td>
                      <td>{r.full_name}</td>

                      <td>
                        <span className={`status-badge ${r.is_processed ? "status-processed" : "status-pending"}`}>
                          {r.is_processed ? "✅ Обработана" : "⏳ Ожидает"}
                        </span>
                      </td>

                      <td>
                        <button
                          className={`btn btn-small ${locked ? "disabled" : ""}`}
                          onClick={() => openEdit(r)}
                          type="button"
                          disabled={locked || busy}
                          title={locked ? "Обработанную заявку нельзя редактировать" : "Редактировать"}
                        >
                          ✏️ Редактировать
                        </button>{" "}

                        <button
                          className={`btn btn-small ${locked ? "disabled" : ""}`}
                          onClick={() => void deleteRequest(r)}
                          type="button"
                          disabled={locked || busy}
                          title={locked ? "Обработанную заявку нельзя удалить" : "Удалить"}
                        >
                          🗑️ Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: 14 }} className="small-muted">
            <Link href="/materials">← Вернуться к материалам</Link>
          </div>
        </div>
      </div>
    </div>
  );
}