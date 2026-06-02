// app/(app)/gatehouse/requests/GatehouseRequestsClient.tsx
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
    return text.split(",").map((item) => item.trim()).filter(Boolean);
  }
  const single = String(value ?? "").trim();
  return single ? [single] : [];
}

function getRequestLevels(request: GatehousePurchaseRequest): GatehouseLevelCode[] {
  const source = Array.isArray(request.target_levels) && request.target_levels.length ? request.target_levels : request.target_level;
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
  const kinds = Array.isArray(request.material_kinds) && request.material_kinds.length ? request.material_kinds : request.textbook_types;
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
    selectedLevel: "stage_1", 
  };
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
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : error == null ? "" : String(error);
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

  const pendingRequests = requests.filter((request) => !request.is_processed);
  const processedRequests = requests.filter((request) => request.is_processed);
  const lastPendingRequest = pendingRequests[0] ?? null;

  function showNotice(text: string, type: Notice["type"] = "success") {
    setNotice({ type, text });
    window.setTimeout(() => setNotice(null), 4500);
  }

  function openPayment() {
    setPaymentOpen(true);
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
    const firstLevel = getRequestLevels(request)[0] ?? "stage_1";
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
    
    // ЖЕСТКАЯ БЛОКИРОВКА СОХРАНЕНИЯ ДО 20 ИЮНЯ
    showNotice("Оформление заявок временно недоступно. Открытие 20 июня.", "error");
    return;
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
    <main className="gatehouse-page" style={{ minHeight: '100vh', padding: '24px 0', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#f8fafc' }}>
      <div className="gatehouse-container" style={{ width: '95%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ИСПОЛЬЗУЕМ НАШ НОВЫЙ ЕДИНЫЙ ХЕДЕР */}
        <GatehouseHeader />

        {/* ЗАГОЛОВОК СТРАНИЦЫ */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-block', padding: '6px 12px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '8px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px', border: '1px solid rgba(99,102,241,0.2)' }}>
            Gatehouse Awards
          </div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 950, letterSpacing: '-0.04em', color: '#f8fafc' }}>
            Управление заяками
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '15px', maxWidth: '600px', lineHeight: 1.5 }}>
            Здесь вы можете создать заявку на получение доступа к экзаменационным материалам и отслеживать её статус.
          </p>
        </div>

        {notice && (
          <div className={`gatehouse-message ${notice.type === "success" ? "gatehouse-message--success" : "gatehouse-message--error"}`} style={{ marginBottom: '24px' }}>
            {notice.text}
          </div>
        )}

        <div className="gatehouse-profile__grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* LEFT SIDEBAR (Создание и Оплата) */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Карточка создания заявки */}
            <div className="gatehouse-card" style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 900, color: '#f8fafc' }}>Новая заявка</h2>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                Пробные тесты уже подготовлены и находятся на стадии финальной проверки. Оформление новых заявок откроется <strong>20 июня</strong>.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={openCreate} 
                  disabled={busy}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(99,102,241,0.25)' }}
                >
                  <span>📝</span> Открыть форму заявки
                </button>

                {lastPendingRequest && (
                  <button 
                    type="button" 
                    onClick={openPayment} 
                    disabled={busy}
                    style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <span>💳</span> Показать оплату
                  </button>
                )}
              </div>

              {formOpen && (
                <form onSubmit={handleSubmit} style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Номер заявки</label>
                    <input value={form.request_number} readOnly disabled style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#64748b', fontSize: '14px', outline: 'none' }} />
                  </div>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Статус материалов</label>
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', color: '#fca5a5', fontSize: '13px', lineHeight: 1.5, fontWeight: 600 }}>
                      Пробные тесты проходят финальную проверку. Сохранение заявок временно заблокировано до 20 июня.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    {/* КНОПКА ЗАБЛОКИРОВАНА */}
                    <button type="submit" disabled={true} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px', fontWeight: 800, cursor: 'not-allowed' }}>
                      Откроется 20 июня
                    </button>
                    <button type="button" onClick={closeForm} disabled={busy} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', fontWeight: 800, cursor: busy ? 'not-allowed' : 'pointer' }}>
                      Скрыть
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Карточка Оплаты */}
            <div className="gatehouse-card" style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 900, color: '#f8fafc' }}>Оплата по QR</h2>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                После создания заявки и её подтверждения вы сможете оплатить материалы через СБП.
              </p>

              {paymentOpen ? (
                <div>
                  {/* ЗАГЛУШКА ОПЛАТЫ ДО 20 ИЮНЯ */}
                  <div style={{ overflow: "hidden", borderRadius: '16px', background: "rgba(255,255,255,0.05)", padding: '24px 14px', border: '1px dashed rgba(255,255,255,0.1)', display: "flex", flexDirection: "column", alignItems: "center", gap: '10px', minHeight: '120px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', opacity: 0.5 }}>🔒</div>
                    <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700, lineHeight: 1.4 }}>
                      Оплата временно закрыта.<br/>Прием платежей начнется 20 июня после завершения проверки материалов.
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    <button onClick={() => setPaymentOpen(false)} style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}>Скрыть</button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '30px 20px', textAlign: 'center', background: 'rgba(15,23,42,0.4)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.8 }}>💳</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>Скрыто до 20 июня</div>
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT MAIN CONTENT (Таблица заявок) */}
          <main>
            <div style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '28px', padding: 'clamp(20px, 4vw, 32px)', backdropFilter: 'blur(24px)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: '#f8fafc' }}>Мои заявки</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}><span style={{ color: '#fbbf24' }}>⏳</span> {pendingRequests.length} ожидают</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}><span style={{ color: '#34d399' }}>✅</span> {processedRequests.length} обработано</div>
                </div>
              </div>

              {requests.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {requests.map((request) => {
                    const levels = getRequestLevels(request);
                    const isProcessed = request.is_processed;

                    return (
                      <div key={request.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px 20px', transition: 'background 0.2s' }}>
                        
                        {/* Левая часть - Информация */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 900, color: '#f8fafc' }}>{request.request_number}</span>
                            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, background: isProcessed ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)', color: isProcessed ? '#34d399' : '#fbbf24' }}>
                              {isProcessed ? "Обработано" : "Ожидает оплаты"}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <span>{formatDateTime(request.created_at)}</span>
                            <span>•</span>
                            <span style={{ color: '#c7d2fe' }}>{getRequestMaterialLabel(request)}</span>
                            <span>•</span>
                            <span>Уровни: {formatGatehouseLevels(levels) || "Не указаны"}</span>
                          </div>
                        </div>

                        {/* Правая часть - Кнопки управления */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {!isProcessed && (
                            <>
                              <button onClick={() => openEdit(request)} disabled={busy} style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontWeight: 800, fontSize: '12px', cursor: busy ? 'not-allowed' : 'pointer' }}>
                                Изменить
                              </button>
                              <button onClick={() => void deleteRequest(request)} disabled={busy} style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', fontWeight: 800, fontSize: '12px', cursor: busy ? 'not-allowed' : 'pointer' }}>
                                Удалить
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '20px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>📋</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', marginBottom: '8px' }}>Заявок пока нет</h3>
                  <p style={{ fontSize: '15px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                    Форма подачи заявок откроется 20 июня, после финальной проверки материалов.
                  </p>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 900px) {
          .gatehouse-profile__grid { grid-template-columns: 1fr !important; }
        }
      `}} />
    </main>
  );
}