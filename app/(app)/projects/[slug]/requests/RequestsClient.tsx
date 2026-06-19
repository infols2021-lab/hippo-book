// app/(app)/projects/[slug]/requests/RequestsClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { useRouter } from "next/navigation";

import "./requests.css";

type ProjectLevel = { id: string; code: string; label: string; };
type ProjectTab = { id: string; slug: string; title: string; icon: string | null; price?: number };
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
  total_price?: number | null;
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
  const t = encodeURIComponent(String(seed ?? Date.now()));
  return `/api/storage/public/help-images/oplata.png?t=${t}`;
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
    total_price: row?.total_price ?? null,
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
  const [classLevel, setClassLevel] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  
  const [currentEmail, setCurrentEmail] = useState(userEmail);
  const [currentFullName, setCurrentFullName] = useState(userFullName);

  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);
  const [qrSeed, setQrSeed] = useState<number>(() => Date.now());
  const [qrLoading, setQrLoading] = useState(true); 
  const [qrError, setQrError] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);

  const tabTitleToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tabs) {
      if (t.title) map.set(t.title, t.id);
    }
    return map;
  }, [tabs]);

  const getTabPrice = (tabId: string): number => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.price ?? 0;
  };

  const totalAmount = selectedTabs.reduce((sum, id) => sum + getTabPrice(id), 0);

  const lastPendingRequest = useMemo(() => {
    return requests.find((r) => !r.is_processed) ?? null;
  }, [requests]);

  const lastPendingAmount = useMemo(() => {
    if (!lastPendingRequest) return 0;
    if (lastPendingRequest.total_price != null) return lastPendingRequest.total_price;

    const tabNames = lastPendingRequest.material_kinds?.length ? lastPendingRequest.material_kinds : (lastPendingRequest.textbook_types || []);
    const ids = tabNames.map(name => tabTitleToId.get(name) || name); 
    return ids.reduce((sum, id) => sum + getTabPrice(id), 0);
  }, [lastPendingRequest, tabTitleToId, tabs]);

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

  function openCreate() {
    setEditingId(null);
    setRequestNumber(generateRequestNumber());
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRequestDateTime(localISO);
    setClassLevel("");
    setSelectedTabs([]);
    setCurrentEmail(userEmail);
    setCurrentFullName(userFullName);
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

    const rawTabs = r.material_kinds?.length ? r.material_kinds : (r.textbook_types || []);
    const tabIds = rawTabs.map(name => tabTitleToId.get(name) || name);
    setSelectedTabs(tabIds);

    setCurrentEmail(r.email || userEmail);
    setCurrentFullName(r.full_name || userFullName);
    
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
      branch_type: project.slug,
      project_id: project.id,
      class_level: classLevel,
      textbook_types: selectedTabs,
      material_kinds: selectedTabs,
      email: currentEmail,
      full_name: currentFullName,
      user_id: userId,
      is_processed: false,
      total_price: totalAmount,
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
      router.refresh();
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
      router.refresh();
    } catch (e: any) {
      showNotification("Ошибка: " + e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const brandMark = project.name.substring(0, 2).toUpperCase() || "EK";

  const formatPrice = (price: number) => {
    if (price === 0) return "бесплатно";
    return `${price} ₽`;
  };

  return (
    <div className="page-requests">
      {notif ? <div className={`notification ${notif.type === "error" ? "error" : ""}`}>{notif.text}</div> : null}

      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title={editingId ? "Редактировать заявку" : "Создать заявку"} maxWidth={520}>
        <form onSubmit={(e) => { e.preventDefault(); void saveRequest(); }}>
          <div className="form-group">
            <label>Номер заявки:</label>
            <input type="text" value={requestNumber} readOnly className="bg-gray-100" />
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
            <label>Разделы материалов:</label>
            <div className="checkbox-group">
              {tabs.map(t => {
                const isChecked = selectedTabs.includes(t.id);
                const price = t.price ?? 0;
                return (
                  <div
                    key={t.id}
                    className={`checkbox-item ${isChecked ? "checked" : ""}`}
                    onClick={() => setSelectedTabs(prev => isChecked ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                  >
                    <input type="checkbox" checked={isChecked} readOnly />
                    <label>
                      {t.icon} {t.title}
                      <span className="price-info">({formatPrice(price)})</span>
                    </label>
                  </div>
                );
              })}
              {tabs.length === 0 && <span className="text-gray-500 text-sm">В проекте пока нет разделов</span>}
            </div>
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input 
              type="email" 
              value={currentEmail} 
              onChange={(e) => setCurrentEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>ФИО ученика:</label>
            <input 
              type="text" 
              value={currentFullName} 
              onChange={(e) => setCurrentFullName(e.target.value)}
              required
            />
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

      <Modal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title="✅ Оплата заявки" maxWidth={540}>
        <div style={{ background: "color-mix(in srgb, var(--project-primary) 12%, transparent)", padding: "18px", borderRadius: "14px", border: "1px solid color-mix(in srgb, var(--project-primary) 25%, transparent)", marginBottom: "20px" }}>
          <h4 style={{ margin: "0 0 14px 0", color: "var(--project-primary)", fontSize: "16px", filter: "brightness(0.7)" }}>📋 Инструкция по оплате</h4>
          <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--project-text)", display: "flex", flexDirection: "column", gap: "10px", fontSize: "14px" }}>
            <li><strong>Отсканируйте QR-код</strong> в вашем банковском приложении.</li>
            <li>Сумма к оплате: <strong style={{ fontSize: "16px", color: "var(--project-primary)" }}>{paymentTotalAmount > 0 ? `${paymentTotalAmount} руб.` : "Сумма не определена"}</strong></li>
            <li>В назначении платежа (сообщении) <strong>ОБЯЗАТЕЛЬНО</strong> укажите: <br/>
              <span style={{ background: "var(--project-card-bg)", padding: "6px 10px", borderRadius: "8px", display: "inline-block", marginTop: "6px", border: "1px solid var(--glass-border)", fontWeight: 700 }}>
                ФИО ребенка, оплата за учебные материалы
              </span>
            </li>
          </ul>
        </div>

        <div className="qr-head">
          <div className="qr-title">QR-код для перевода</div>
          <button type="button" className="qr-refresh" onClick={resetQrStateAndRefresh} title="Обновить QR" aria-label="Обновить QR">↻</button>
        </div>

        <div className="payment-qr payment-qr--smart" style={{ minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {qrLoading && !qrError ? (
            <div className="qr-loader" role="status">
              <span className="qr-spinner" />
              <div className="qr-loader-text" style={{ marginTop: "12px", fontWeight: 700 }}>Загружаем QR-код...</div>
            </div>
          ) : null}

          {qrError ? (
            <div className="qr-error" role="alert" style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#d32f2f" }}>Не удалось загрузить QR-код</div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>Возможно, файл oplata.png отсутствует на сервере.</div>
              <button type="button" className="btn secondary" onClick={resetQrStateAndRefresh}>↻ Попробовать снова</button>
            </div>
          ) : null}

          <img
            key={qrUrl}
            src={qrUrl}
            alt="QR-код для оплаты"
            className={`qr-img`}
            onLoad={() => { setQrLoading(false); setQrError(false); }}
            onError={() => { setQrLoading(false); setQrError(true); }}
            style={{ 
              display: qrLoading || qrError ? "none" : "block", 
              width: "100%", 
              maxWidth: "240px", 
              margin: "0 auto", 
              borderRadius: "16px", 
              border: "1px solid rgba(0,0,0,0.1)", 
              boxShadow: "0 12px 30px rgba(0,0,0,0.08)" 
            }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button className="btn" style={{ width: "100%" }} type="button" onClick={() => setPaymentModalOpen(false)}>
            Я всё оплатил(а)
          </button>
        </div>
      </Modal>

      <div className="container">
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
              Стоимость каждого раздела указывается индивидуально. QR-код для оплаты появляется сразу после создания заявки.
              После подтверждения оплаты администратором доступ к материалам будет открыт автоматически.
            </p>
          </div>

          <div className="requests-actions">
            <button className="btn" onClick={openCreate} type="button" disabled={busy}>
              ➕ Создать новую заявку
            </button>
            <button className="btn ghost qr-open" type="button" onClick={() => { 
              if (!lastPendingRequest) {
                showNotification("ℹ️ Не найдено необработанных заявок.", "error");
                return;
              }
              openPaymentModal(lastPendingAmount); 
            }}>
              📷 Показать qr
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>📭 Заявок пока нет</h3>
              <p>Создайте свою первую заявку на покупку доступа к материалам</p>
              <button className="btn" onClick={openCreate} type="button" disabled={busy}>
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
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const locked = r.is_processed;
                  const rawTabs = r.material_kinds?.length ? r.material_kinds : (r.textbook_types || []);
                  
                  const displayTabs = rawTabs.map(id => {
                    const tab = tabs.find(t => t.id === id);
                    return tab ? `${tab.icon || ''} ${tab.title}` : id;
                  }).filter(Boolean);

                  return (
                    <tr key={r.id}>
                      <td className="font-bold">{r.request_number}</td>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{r.class_level || "—"}</td>
                      <td>{displayTabs.length > 0 ? displayTabs.join(", ") : "—"}</td>
                      <td className="font-bold">{r.total_price != null ? formatPrice(r.total_price) : "—"}</td>
                      <td>
                        <span className={`status-badge ${r.is_processed ? "status-processed" : "status-pending"}`}>
                          {r.is_processed ? "✅ Выдано" : "⏳ Ожидает"}
                        </span>
                      </td>
                      <td>
                        {!locked && (
                          <>
                            <button className="btn btn-small" onClick={() => openEdit(r)} type="button" disabled={busy}>
                              ✏️ Изменить
                            </button>{" "}
                            <button className="btn btn-small secondary" onClick={() => void deleteRequest(r)} type="button" disabled={busy}>
                              🗑️ Удалить
                            </button>
                          </>
                        )}
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