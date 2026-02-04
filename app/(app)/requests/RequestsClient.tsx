/* app/(app)/requests/RequestsClient.tsx */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import AppHeader from "@/components/AppHeader";
import Modal from "@/components/Modal";

type PurchaseRequest = {
  id: string;
  request_number: string;
  created_at: string;
  class_level: string;
  textbook_types: string[] | null;
  email: string;
  full_name: string;
  is_processed: boolean;
  user_id: string;
};

type Props = {
  userId: string;
  userEmail: string;
  userFullName: string;
  initialRequests: PurchaseRequest[];
};

function generateRequestNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PR-${year}${month}${day}-${random}`;
}

function formatClassLevel(classLevel: string) {
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

function formatTextbookTypes(types: string[] | null) {
  if (!types || !Array.isArray(types)) return "";
  const typeMap: Record<string, string> = { учебник: "📚 Учебник", кроссворд: "🧩 Кроссворд" };
  return types.map((t) => typeMap[t] || t).join(", ");
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPaymentQRUrl(seed?: number) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const t = seed ?? Date.now(); // ✅ seed позволяет форс-обновить URL
  return `${base}/storage/v1/object/public/help-images/oplata.png?t=${t}`;
}

export default function RequestsClient({ userId, userEmail, userFullName, initialRequests }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [requests, setRequests] = useState<PurchaseRequest[]>(initialRequests);
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);

  const [requestNumber, setRequestNumber] = useState("");
  const [requestDateTime, setRequestDateTime] = useState(""); // datetime-local string
  const [classLevel, setClassLevel] = useState("");

  const [typeTextbook, setTypeTextbook] = useState(false);
  const [typeCrossword, setTypeCrossword] = useState(false);

  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);

  // ✅ QR state (loader + retry)
  const [qrSeed, setQrSeed] = useState<number>(() => Date.now());
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);

  function resetQrStateAndRefresh() {
    setQrError(false);
    setQrLoading(true);
    setQrSeed(Date.now()); // меняем querystring -> браузер точно перезагрузит
  }

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  }

  async function reloadRequests() {
    const { data, error } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      showNotification("Ошибка загрузки заявок: " + error.message, "error");
      return;
    }
    setRequests((data ?? []) as PurchaseRequest[]);
  }

  function totalTypesSelected() {
    return (typeTextbook ? 1 : 0) + (typeCrossword ? 1 : 0);
  }

  function selectedTypesArray() {
    const arr: string[] = [];
    if (typeTextbook) arr.push("учебник");
    if (typeCrossword) arr.push("кроссворд");
    return arr;
  }

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
    setEditingId(r.id);
    setRequestNumber(r.request_number);

    const d = new Date(r.created_at);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);

    setRequestDateTime(localISO);
    setClassLevel(r.class_level);

    const types = r.textbook_types ?? [];
    setTypeTextbook(types.includes("учебник"));
    setTypeCrossword(types.includes("кроссворд"));

    setRequestModalOpen(true);
  }

  async function saveRequest() {
    if (!requestDateTime || !classLevel) {
      showNotification("❌ Пожалуйста, заполните все обязательные поля", "error");
      return;
    }

    const types = selectedTypesArray();
    if (types.length === 0) {
      showNotification("❌ Пожалуйста, выберите хотя бы один тип материала", "error");
      return;
    }

    const payload = {
      request_number: requestNumber,
      created_at: requestDateTime + ":00Z",
      class_level: classLevel,
      textbook_types: types,
      email: userEmail,
      full_name: userFullName,
      user_id: userId,
      is_processed: false,
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from("purchase_requests")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId);

        if (error) throw error;

        setRequestModalOpen(false);
        showNotification("✅ Заявка успешно обновлена");
        await reloadRequests();
        return;
      }

      // ✅ ВАЖНО: создание заявки теперь через серверный API
      const res = await fetch("/api/requests/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request_number: payload.request_number,
          created_at: payload.created_at,
          class_level: payload.class_level,
          textbook_types: payload.textbook_types,
          email: payload.email,
          full_name: payload.full_name,
        }),
      });

      const t = await res.text();
      let json: any = null;
      try {
        json = t ? JSON.parse(t) : null;
      } catch {
        json = null;
      }

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setRequestModalOpen(false);

      const totalAmount = types.length * 1000;
      setPaymentTotalAmount(totalAmount);

      // ✅ когда открываем оплату — сразу показываем лоадер и обновляем URL
      setPaymentModalOpen(true);
      setQrLoading(true);
      setQrError(false);
      setQrSeed(Date.now());

      // если Sheets не записался — покажем мягкое предупреждение (заявка всё равно создана)
      if (json?.sheet && json.sheet.ok === false) {
        showNotification("⚠️ Заявка создана, но запись в таблицу временно не удалась. Админ досинхронизирует позже.", "error");
      }

      await reloadRequests();
    } catch (e: any) {
      showNotification("❌ Ошибка при сохранении заявки: " + (e?.message || String(e)), "error");
    }
  }

  async function deleteRequest(r: PurchaseRequest) {
    if (r.user_id !== userId) {
      showNotification("❌ Вы можете удалять только свои заявки", "error");
      return;
    }

    const ok = window.confirm(`Вы уверены, что хотите удалить заявку ${r.request_number}?`);
    if (!ok) return;

    const { error } = await supabase.from("purchase_requests").delete().eq("id", r.id).eq("user_id", userId);
    if (error) {
      showNotification("Ошибка при удалении заявки: " + error.message, "error");
      return;
    }

    showNotification("✅ Заявка успешно удалена");
    await reloadRequests();
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
            <label>Тип учебника (стоимость каждого учебника 1000р):</label>
            <div className="checkbox-group">
              <div className={`checkbox-item ${typeTextbook ? "checked" : ""}`} onClick={() => setTypeTextbook((v) => !v)}>
                <input type="checkbox" checked={typeTextbook} readOnly />
                <label>
                  Учебник <span className="price-info">(1000р)</span>
                </label>
              </div>

              <div className={`checkbox-item ${typeCrossword ? "checked" : ""}`} onClick={() => setTypeCrossword((v) => !v)}>
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
            <button type="button" className="btn secondary" onClick={() => setRequestModalOpen(false)}>
              ❌ Отмена
            </button>
            <button type="submit" className="btn">
              💾 Сохранить заявку
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="✅ Заявка создана успешно!"
        maxWidth={520}
      >
        <div className="success-message">
          <h4>📋 Информация о заявке</h4>
          <p>
            <strong>Доступ к выбранным материалам будет открыт через некоторое время после оплаты.</strong>
          </p>
          <p>Оплатить можно по QR-коду ниже:</p>
        </div>

        <div className="total-amount">
          <h4>💰 Сумма к оплате:</h4>
          <div className="amount">{paymentTotalAmount} руб.</div>
        </div>

        {/* ✅ QR area with loader + refresh */}
        <div className="qr-head">
          <div className="qr-title">QR-код для оплаты</div>
          <button
            type="button"
            className="qr-refresh"
            onClick={resetQrStateAndRefresh}
            title="Обновить QR"
            aria-label="Обновить QR"
          >
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
            { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
          ]}
        />

        <div className="card">
          <h2 style={{ color: "var(--accent2)", marginBottom: 20 }}>📝 Мои заявки на учебники</h2>

          <div className="payment-info">
            <h4>💰 Информация об оплате</h4>
            <p>
              Оплата материалов происходит по QR-коду после создания заявки или по кнопке ниже "Показать qr". Стоимость каждого
              учебника или кроссворда — 1000 рублей. После подтверждения оплаты доступ к материалам будет открыт в течение 24 часов.
            </p>
          </div>

          <div className="requests-actions">
            <button className="btn" onClick={openCreate} type="button">
              ➕ Создать новую заявку
            </button>

            <button
              className="btn ghost qr-open"
              type="button"
              onClick={() => {
                setPaymentTotalAmount(0);
                setPaymentModalOpen(true);
                setQrLoading(true);
                setQrError(false);
                setQrSeed(Date.now());
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
              <button className="btn" onClick={openCreate} type="button">
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
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.request_number}</strong>
                    </td>
                    <td>{formatDateTime(r.created_at)}</td>
                    <td>{formatClassLevel(r.class_level)}</td>
                    <td>{formatTextbookTypes(r.textbook_types)}</td>
                    <td>{r.email}</td>
                    <td>{r.full_name}</td>
                    <td>
                      <span className={`status-badge ${r.is_processed ? "status-processed" : "status-pending"}`}>
                        {r.is_processed ? "✅ Обработана" : "⏳ Ожидает"}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-small" onClick={() => openEdit(r)} type="button">
                        ✏️ Редактировать
                      </button>{" "}
                      <button className="btn btn-small" onClick={() => void deleteRequest(r)} type="button">
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                ))}
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
