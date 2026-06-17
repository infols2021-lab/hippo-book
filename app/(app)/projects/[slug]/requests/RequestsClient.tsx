"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { useRouter } from "next/navigation";

// 🔥 Подтягиваем твой оригинальный CSS-файл заявок по правильному пути!
import "../../../../requests/requests.css";

// Типы из БД
type ProjectLevel = { id: string; code: string; label: string; };
type ProjectTab = { id: string; slug: string; title: string; icon: string | null; };
type Project = { id: string; name: string; slug: string; };

type PurchaseRequest = {
  id: string;
  request_number: string;
  created_at: string;
  class_level: string | null;
  textbook_types: string[] | null;
  material_kinds?: string[] | null;
  email: string;
  full_name: string;
  is_processed: boolean;
  user_id: string;
  project_id?: string | null;
};

type Props = {
  project: Project;
  levels: ProjectLevel[];
  tabs: ProjectTab[];
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

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeString(item)).filter(Boolean);
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[") && text.endsWith("]")) {
      try { return toStringArray(JSON.parse(text)); } catch { return []; }
    }
    return text.split(",").map((item) => item.trim()).filter(Boolean);
  }
  const single = normalizeString(value);
  return single ? [single] : [];
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { text, json };
}

function normalizeRequestRow(row: any): PurchaseRequest {
  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    textbook_types: toStringArray(row?.textbook_types),
    material_kinds: toStringArray(row?.material_kinds),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    is_processed: Boolean(row?.is_processed),
    project_id: row?.project_id ?? null,
  };
}

export default function RequestsClient({ project, levels, tabs, userId, userEmail, userFullName, initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<PurchaseRequest[]>(() => initialRequests.map(normalizeRequestRow));
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState("");
  const [requestDateTime, setRequestDateTime] = useState("");
  
  // Храним выбранные значения из БД
  const [classLevel, setClassLevel] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]); // Массив названий (title) выбранных табов

  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);
  const [qrSeed, setQrSeed] = useState<number>(() => Date.now());
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);

  useEffect(() => {
    setRequests(initialRequests.map(normalizeRequestRow));
  }, [initialRequests]);

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  }

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

  // Считаем сумму (каждый раздел = 1000р)
  const totalAmount = selectedTabs.length * 1000;

  const lastPendingRequest = useMemo(() => {
    return requests.find((r) => !r.is_processed) ?? null;
  }, [requests]);

  const lastPendingAmount = useMemo(() => {
    if (!lastPendingRequest) return 0;
    const kinds = lastPendingRequest.material_kinds?.length ? lastPendingRequest.material_kinds : (lastPendingRequest.textbook_types || []);
    return kinds.length * 1000;
  }, [lastPendingRequest]);

  function openCreate() {
    setEditingId(null);
    setRequestNumber(generateRequestNumber());
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRequestDateTime(localISO);
    
    setClassLevel("");
    setSelectedTabs([]);
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
    const existingTabs = r.material_kinds?.length ? r.material_kinds : (r.textbook_types || []);
    setSelectedTabs(existingTabs);
    
    setRequestModalOpen(true);
  }

  async function saveRequest() {
    if (busy) return;
    if (!requestDateTime || !classLevel) {
      showNotification("❌ Пожалуйста, выберите уровень", "error");
      return;
    }
    if (selectedTabs.length === 0) {
      showNotification("❌ Пожалуйста, выберите хотя бы один раздел", "error");
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
      branch_type: "olympiad", // Легаси байпасс
      project_id: project.id,  // Идентификатор ветки!
      class_level: classLevel,
      textbook_types: selectedTabs, 
      material_kinds: selectedTabs,
      email: userEmail,
      full_name: userFullName,
      user_id: userId,
      is_processed: false,
    };

    setBusy(true);

    try {
      const url = editingId ? "/api/requests/update" : "/api/requests/create";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });

      const { json } = await safeReadJson(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      setRequestModalOpen(false);
      openPaymentModal(totalAmount);
      showNotification(editingId ? "✅ Заявка успешно обновлена" : "✅ Заявка успешно создана");
      
      router.refresh(); // Обновляем данные с сервера
    } catch (e: any) {
      showNotification("❌ Ошибка: " + e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRequest(r: PurchaseRequest) {
    if (busy) return;
    if (r.is_processed) {
      showNotification("🔒 Обработанную заявку нельзя удалить", "error");
      return;
    }

    const okConfirm = window.confirm(`Удалить заявку ${r.request_number}?`);
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
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);

      showNotification("✅ Заявка успешно удалена");
      router.refresh(); // Обновляем серверный стейт
    } catch (e: any) {
      showNotification("Ошибка: " + e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const brandMark = project.name.substring(0, 2).toUpperCase() || "EK";

  return (
    <div className="page-requests">
      {notif ? <div className={`notification ${notif.type === "error" ? "error" : ""}`}>{notif.text}</div> : null}

      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title={editingId ? "Редактировать заявку" : "Создать заявку"} maxWidth={520}>
        <form onSubmit={(e) => { e.preventDefault(); void saveRequest(); }}>
          <div className="form-group">
            <label>Номер заявки:</label>
            <input type="text" value={requestNumber} readOnly />
          </div>

          <div className="form-group">
            <label>Класс (Уровень):</label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} required>
              <option value="">-- Выберите уровень --</option>
              {levels.map(l => (
                <option key={l.id} value={l.label}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Разделы материалов (каждый раздел 1000р):</label>
            <div className="checkbox-group">
              {tabs.map(t => {
                const isChecked = selectedTabs.includes(t.title);
                return (
                  <div
                    key={t.id}
                    className={`checkbox-item ${isChecked ? "checked" : ""}`}
                    onClick={() => setSelectedTabs(prev => isChecked ? prev.filter(x => x !== t.title) : [...prev, t.title])}
                  >
                    <input type="checkbox" checked={isChecked} readOnly />
                    <label>
                      {t.icon} {t.title} <span className="price-info">(1000р)</span>
                    </label>
                  </div>
                );
              })}
              {tabs.length === 0 && <span className="text-gray-500 text-sm">В проекте пока нет разделов</span>}
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
            <button type="button" className="btn secondary" onClick={() => setRequestModalOpen(false)} disabled={busy}>❌ Отмена</button>
            <button type="submit" className="btn" disabled={busy}>{busy ? "Сохраняем..." : "💾 Сохранить заявку"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="✅ Заявка" maxWidth={520}>
        <div className="success-message">
          <h4>📋 Информация</h4>
          <p><strong>Доступ к выбранным материалам будет открыт после подтверждения оплаты.</strong></p>
          <p>Оплатить можно по QR-коду ниже.</p>
        </div>

        {paymentTotalAmount > 0 ? (
          <div className="total-amount">
            <h4>💰 Сумма к оплате:</h4>
            <div className="amount">{paymentTotalAmount} руб.</div>
            <p className="small-muted" style={{ marginTop: 8 }}>В платеже обязательно укажите ФИО, а в назначении платежа — «за учебные пособия».</p>
          </div>
        ) : (
          <div className="small-muted" style={{ marginTop: 8 }}>
            {lastPendingRequest ? "Сумма к оплате не определена." : "Нет необработанных заявок."}
          </div>
        )}

        <div className="qr-head">
          <div className="qr-title">QR-код для оплаты</div>
          <button type="button" className="qr-refresh" onClick={resetQrStateAndRefresh} title="Обновить QR" aria-label="Обновить QR">↻</button>
        </div>

        <div className="payment-qr payment-qr--smart">
          {qrLoading ? (
            <div className="qr-loader" role="status">
              <span className="qr-spinner" />
              <div className="qr-loader-text">Загружаю QR-код…</div>
            </div>
          ) : null}

          {qrError ? (
            <div className="qr-error" role="alert">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Не удалось загрузить QR-код</div>
              <button type="button" className="btn" onClick={resetQrStateAndRefresh}>↻ Обновить QR</button>
            </div>
          ) : null}

          <img
            key={qrUrl}
            src={qrUrl}
            alt=""
            aria-hidden="true"
            className={`qr-img ${qrLoading || qrError ? "is-hidden" : ""}`}
            onLoad={() => { setQrLoading(false); setQrError(false); }}
            onError={() => { setQrLoading(false); setQrError(true); }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn" type="button" onClick={() => setPaymentModalOpen(false)}>Понятно</button>
        </div>
      </Modal>

      <div className="container">
        {/* ИДЕАЛЬНЫЙ TOPBAR КАК В ПРОФИЛЕ */}
        <div className="profile-topbar">
          <div className="brand">
            <div className="brand-mark">{brandMark}</div>
            <div>
              <div className="brand-title">{project.name}</div>
              <div className="brand-subtitle">Заявки на доступы</div>
            </div>
          </div>
          <div className="top-actions">
            <Link className="nav-pill nav-pill--info" href={`/projects/${project.slug}/profile`}>👤 Профиль</Link>
            <Link className="nav-pill nav-pill--materials" href={`/projects/${project.slug}/materials`}>📚 Материалы</Link>
            <Link className="nav-pill nav-pill--logout" href="/portal">🏠 Портал</Link>
          </div>
        </div>

        <div className="card">
          <h2 style={{ color: "var(--project-primary)", marginBottom: 20 }}>📝 Мои заявки на доступы</h2>

          <div className="payment-info">
            <h4>💰 Информация об оплате</h4>
            <p>
              Стоимость каждого раздела — 1000 рублей. QR-код для оплаты появляется сразу после создания заявки. 
              После подтверждения оплаты администратором доступ к материалам будет открыт автоматически.
            </p>
          </div>

          <div className="requests-actions">
            <button className="btn" onClick={openCreate} type="button" disabled={busy} style={{ backgroundColor: "var(--project-primary)" }}>
              ➕ Создать новую заявку
            </button>
            <button className="btn ghost qr-open" type="button" onClick={() => { openPaymentModal(lastPendingAmount); if (!lastPendingRequest) showNotification("ℹ️ Не найдено необработанных заявок.", "error"); }}>
              📷 Показать qr
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>📭 Заявок пока нет</h3>
              <p>Создайте свою первую заявку на покупку доступа к материалам</p>
              <button className="btn" onClick={openCreate} type="button" disabled={busy} style={{ backgroundColor: "var(--project-primary)" }}>
                ➕ Создать заявку
              </button>
            </div>
          ) : (
            <table className="requests-table">
              <thead>
                <tr>
                  <th>Номер заявки</th>
                  <th>Дата создания</th>
                  <th>Уровень (Класс)</th>
                  <th>Разделы материалов</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const locked = r.is_processed;
                  const tabsList = r.material_kinds?.length ? r.material_kinds : (r.textbook_types || []);
                  
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.request_number}</strong></td>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{r.class_level || "—"}</td>
                      <td>{tabsList.length > 0 ? tabsList.join(", ") : "—"}</td>
                      <td>
                        <span className={`status-badge ${r.is_processed ? "status-processed" : "status-pending"}`}>
                          {r.is_processed ? "✅ Выдано" : "⏳ Ожидает"}
                        </span>
                      </td>
                      <td>
                        <button className={`btn btn-small ${locked ? "disabled" : ""}`} onClick={() => openEdit(r)} type="button" disabled={locked || busy}>
                          ✏️ Изменить
                        </button>{" "}
                        <button className={`btn btn-small ${locked ? "disabled" : ""}`} onClick={() => void deleteRequest(r)} type="button" disabled={locked || busy}>
                          🗑️ Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}