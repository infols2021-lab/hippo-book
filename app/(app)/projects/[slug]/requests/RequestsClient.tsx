"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { useRouter } from "next/navigation";

import "./requests.css";

type ProjectLevel = { id: string; code: string; label: string; price?: number | null };
type ProjectTab = { id: string; slug: string; title: string; icon: string | null };
type Project = {
  id: string;
  name: string;
  slug: string;
  theme?: { primaryColor?: string; secondaryColor?: string } | null;
  themeColor?: string | null;
};

type MaterialItem = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  price: number;
  project_tab_id: string | null;
  material_kind: string;
  target_levels?: string[] | null;
};

type PurchaseRequest = {
  id: string;
  request_number: string;
  created_at: string;
  class_level: string | null;
  textbook_types: string[] | null;
  material_kinds?: string[] | null;
  material_ids?: string[] | null;
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
  ownedMaterialIds?: string[];
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
      try {
        return toStringArray(JSON.parse(text));
      } catch {
        return [];
      }
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
  return d.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPaymentQRUrl(seed?: number) {
  const t = encodeURIComponent(String(seed ?? Date.now()));
  return `/api/storage/public/help-images/oplata.png?t=${t}`;
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
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    textbook_types: toStringArray(row?.textbook_types),
    material_kinds: toStringArray(row?.material_kinds),
    material_ids: toStringArray(row?.material_ids),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    is_processed: Boolean(row?.is_processed),
    project_id: row?.project_id ?? null,
    total_price: typeof row?.total_price === "number" ? row.total_price : null,
  };
}

export default function RequestsClient({
  project,
  levels,
  tabs,
  userId,
  userEmail,
  userFullName,
  initialRequests,
  ownedMaterialIds = [],
}: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<PurchaseRequest[]>(() =>
    initialRequests.map(normalizeRequestRow)
  );

  const [notif, setNotif] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Шаг модалки создания заявки: 1 - выбор в витрине, 2 - подтверждение и чек
  const [modalStep, setModalStep] = useState<1 | 2>(1);

  // Данные витрины
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [activeTabId, setActiveTabId] = useState<string>("all");
  const [selectedLevelCode, setSelectedLevelCode] = useState<string>("all");

  // Состояние формы
  const [editingId, setEditingId] = useState<string | null>(null);
  const [requestNumber, setRequestNumber] = useState("");
  const [requestDateTime, setRequestDateTime] = useState("");
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);

  // Данные оплаты
  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);
  const [qrSeed, setQrSeed] = useState<number>(() => Date.now());
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(false);
  const [busy, setBusy] = useState(false);

  const qrUrl = useMemo(() => getPaymentQRUrl(qrSeed), [qrSeed]);
  const primaryColor = project.theme?.primaryColor || project.themeColor || "#6366f1";

  // Загрузка всех материалов проекта по всем табам для витрины
  useEffect(() => {
    let alive = true;
    async function loadMaterials() {
      setMaterialsLoading(true);
      try {
        if (!tabs || tabs.length === 0) {
          const res = await fetch(`/api/projects/${project.slug}/materials`, { cache: "no-store" });
          const { json } = await safeReadJson(res);
          if (alive && res.ok && json?.ok && Array.isArray(json.materials)) {
            const list: MaterialItem[] = json.materials.map((m: any) => ({
              id: String(m.id),
              title: String(m.title || "Материал"),
              description: m.description ? String(m.description) : null,
              cover_image_url: m.cover_image_url ? String(m.cover_image_url) : null,
              price: typeof m.price === "number" && m.price >= 0 ? m.price : 1000,
              project_tab_id: m.project_tab_id ? String(m.project_tab_id) : null,
              material_kind: String(m.material_kind || ""),
              target_levels: toStringArray(m.target_levels || m.class_levels),
            }));
            setMaterials(list);
          }
          return;
        }

        const tabPromises = tabs.map(async (tab) => {
          const res = await fetch(`/api/projects/${project.slug}/materials?tab=${tab.slug}`, {
            cache: "no-store",
          });
          const { json } = await safeReadJson(res);
          if (res.ok && json?.ok && Array.isArray(json.materials)) {
            return json.materials.map((m: any) => ({
              ...m,
              project_tab_id: m.project_tab_id || tab.id,
              target_levels: toStringArray(m.target_levels || m.class_levels),
            }));
          }
          return [];
        });

        const results = await Promise.all(tabPromises);
        if (!alive) return;

        const allFetched = results.flat();
        const map = new Map<string, MaterialItem>();

        for (const m of allFetched) {
          const item: MaterialItem = {
            id: String(m.id),
            title: String(m.title || "Материал"),
            description: m.description ? String(m.description) : null,
            cover_image_url: m.cover_image_url ? String(m.cover_image_url) : null,
            price: typeof m.price === "number" && m.price >= 0 ? m.price : 1000,
            project_tab_id: m.project_tab_id ? String(m.project_tab_id) : null,
            material_kind: String(m.material_kind || ""),
            target_levels: toStringArray(m.target_levels || m.class_levels),
          };
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        }

        setMaterials(Array.from(map.values()));
      } catch (e) {
        console.error("Ошибка загрузки материалов витрины:", e);
      } finally {
        if (alive) setMaterialsLoading(false);
      }
    }

    loadMaterials();
    return () => {
      alive = false;
    };
  }, [project.slug, tabs]);

  useEffect(() => {
    setRequests(initialRequests.map(normalizeRequestRow));
  }, [initialRequests]);

  const ownedMaterialSet = useMemo(() => {
    const set = new Set<string>(ownedMaterialIds);
    for (const req of requests) {
      if (req.is_processed) {
        const ids = toStringArray(req.material_ids);
        for (const id of ids) set.add(id);
      }
    }
    return set;
  }, [ownedMaterialIds, requests]);

  const getRequestPrice = (r: PurchaseRequest) => {
    if (typeof r.total_price === "number" && r.total_price > 0) {
      return r.total_price;
    }
    const ids = toStringArray(r.material_ids);
    if (ids.length === 0) return 0;
    let calculated = 0;
    for (const id of ids) {
      const mat = materials.find((m) => m.id === id);
      calculated += mat?.price ?? 1000;
    }
    return calculated;
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchTab =
        activeTabId === "all" ||
        m.project_tab_id === activeTabId ||
        m.material_kind === activeTabId;

      const matchLevel =
        selectedLevelCode === "all" ||
        !m.target_levels ||
        m.target_levels.length === 0 ||
        m.target_levels.some(
          (lvl) => lvl.toLowerCase() === selectedLevelCode.toLowerCase()
        );

      return matchTab && matchLevel;
    });
  }, [materials, activeTabId, selectedLevelCode]);

  const selectedMaterialsList = useMemo(() => {
    const set = new Set(selectedMaterialIds);
    return materials.filter((m) => set.has(m.id));
  }, [materials, selectedMaterialIds]);

  const totalPrice = useMemo(() => {
    return selectedMaterialsList.reduce((sum, item) => sum + item.price, 0);
  }, [selectedMaterialsList]);

  const pendingRequests = useMemo(() => {
    return requests.filter((r) => !r.is_processed);
  }, [requests]);

  const aggregatedPendingSummary = useMemo(() => {
    let sum = 0;
    const itemsMap = new Map<string, { title: string; count: number; unitPrice: number }>();

    for (const req of pendingRequests) {
      const reqPrice = getRequestPrice(req);
      sum += reqPrice;

      const ids = toStringArray(req.material_ids);
      for (const id of ids) {
        const mat = materials.find((m) => m.id === id);
        const title = mat?.title || "Учебный материал";
        const unitPrice = mat?.price || 1000;

        const current = itemsMap.get(id) ?? { title, count: 0, unitPrice };
        current.count += 1;
        itemsMap.set(id, current);
      }
    }

    return {
      totalPrice: sum,
      items: Array.from(itemsMap.values()),
      count: pendingRequests.length,
    };
  }, [pendingRequests, materials]);

  function showNotification(text: string, type: "success" | "error" | "info" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  }

  function openPaymentModal(amount: number) {
    const finalAmount = amount > 0 ? amount : aggregatedPendingSummary.totalPrice;
    setPaymentTotalAmount(finalAmount);
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
    setModalStep(1);
    setRequestNumber(generateRequestNumber());
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    setRequestDateTime(localISO);
    setSelectedMaterialIds([]);
    setActiveTabId("all");
    setSelectedLevelCode("all");
    setRequestModalOpen(true);
  }

  function openEdit(r: PurchaseRequest) {
    if (r.is_processed) {
      showNotification("Обработанную заявку нельзя редактировать", "error");
      return;
    }
    setEditingId(r.id);
    setModalStep(1);
    setRequestNumber(r.request_number);
    const d = new Date(r.created_at || new Date().toISOString());
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISO = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setRequestDateTime(localISO);

    setSelectedMaterialIds(r.material_ids || []);
    setActiveTabId("all");
    setSelectedLevelCode("all");

    setRequestModalOpen(true);
  }

  function toggleMaterialSelection(id: string) {
    if (ownedMaterialSet.has(id)) return;
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function saveRequest() {
    if (busy) return;
    if (selectedMaterialIds.length === 0) {
      showNotification("Пожалуйста, выберите хотя бы один материал", "error");
      return;
    }

    const payload = {
      request_number: requestNumber,
      created_at: requestDateTime + ":00Z",
      branch_type: project.slug,
      project_id: project.id,
      material_ids: selectedMaterialIds,
      total_price: totalPrice,
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
      openPaymentModal(totalPrice);
      showNotification(editingId ? "Заявка успешно обновлена" : "Заявка успешно создана");
      router.refresh();
    } catch (e: any) {
      showNotification("Ошибка: " + e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRequest(r: PurchaseRequest) {
    if (busy) return;
    if (r.is_processed) {
      showNotification("Обработанную заявку нельзя удалить", "error");
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

      showNotification("Заявка успешно удалена");
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
    <div
      className="page-requests"
      style={{ "--project-primary": primaryColor } as React.CSSProperties}
    >
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translate3d(100%, 0, 0); opacity: 0; }
          to { transform: translate3d(0, 0, 0); opacity: 1; }
        }

        /* ==== СТИЛИЗАЦИЯ И ФИКСЫ ВИТРИНЫ И МОДАЛКИ ==== */
        .level-filter-container {
          margin-bottom: 12px;
        }
        .level-filter-title {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 6px;
        }
        .level-filter-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .level-chip {
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f1f5f9;
          color: #334155 !important;
          border: 1px solid #cbd5e1;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .level-chip:hover {
          background: #e2e8f0;
          color: #0f172a !important;
        }
        .level-chip.active {
          background: var(--project-primary, #6366f1) !important;
          color: #ffffff !important;
          border-color: var(--project-primary, #6366f1) !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }

        .vitrine-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 16px;
        }
        .vitrine-tab-btn {
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          background: #f1f5f9;
          color: #334155 !important;
          border: 1px solid #cbd5e1;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .vitrine-tab-btn:hover {
          background: #e2e8f0;
          color: #0f172a !important;
        }
        .vitrine-tab-btn.active {
          background: var(--project-primary, #6366f1) !important;
          color: #ffffff !important;
          border-color: var(--project-primary, #6366f1) !important;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        /* Ограниченная адаптивная сетка (карточки не растягиваются на всю модалку) */
        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 230px));
          gap: 16px;
          justify-content: center;
          max-height: 420px;
          overflow-y: auto;
          padding: 4px 4px 12px 4px;
        }

        .material-card {
          background: #ffffff;
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }
        .material-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.06);
        }
        .material-card.selected {
          border-color: var(--project-primary, #6366f1) !important;
          background: #fafafa;
          box-shadow: 0 0 0 2px var(--project-primary, #6366f1);
        }
        .material-card.owned {
          opacity: 0.65;
          cursor: not-allowed;
          background: #f8fafc;
        }

        .material-cover-wrapper {
          height: 130px;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        .material-cover-img {
          max-height: 100%;
          max-width: 100%;
          object-fit: contain;
          border-radius: 8px;
        }

        .material-card-body {
          padding: 12px;
          display: flex;
          flex-direction: column;
          flex: 1;
          justify-content: space-between;
        }
        .material-card-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.3;
          margin-bottom: 10px;
        }
        .material-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          gap: 6px;
        }
        .material-card-price {
          font-size: 14px;
          font-weight: 900;
          color: var(--project-primary, #6366f1);
        }

        .vitrine-card-btn {
          font-size: 11px;
          font-weight: 800;
          padding: 4px 8px;
          border-radius: 8px;
        }
        .vitrine-card-btn.add {
          background: #f1f5f9;
          color: #334155;
        }
        .vitrine-card-btn.remove {
          background: #dcfce7;
          color: #166534;
        }

        .cart-summary-bar {
          margin-top: 16px;
          padding: 12px 18px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .receipt-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .receipt-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          padding: 6px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .receipt-total {
          display: flex;
          justify-content: space-between;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 10px;
          padding-top: 8px;
        }

        .user-locked-field {
          background: #f1f5f9 !important;
          color: #475569 !important;
          font-weight: 700;
          border: 1px solid #cbd5e1;
        }
      `}</style>

      {/* Плавающее уведомление (Toast) */}
      {notif && (
        <div
          style={{
            position: "fixed",
            top: "32px",
            right: "32px",
            zIndex: 999999,
            backgroundColor:
              notif.type === "error"
                ? "#FEF2F2"
                : notif.type === "info"
                ? "#F0F9FF"
                : "#F0FDF4",
            color:
              notif.type === "error"
                ? "#991B1B"
                : notif.type === "info"
                ? "#0369A1"
                : "#166534",
            border: `1px solid ${
              notif.type === "error"
                ? "#FCA5A5"
                : notif.type === "info"
                ? "#BAE6FD"
                : "#BBF7D0"
            }`,
            borderLeft: `5px solid ${
              notif.type === "error"
                ? "#EF4444"
                : notif.type === "info"
                ? "#0EA5E9"
                : "#22C55E"
            }`,
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontWeight: 600,
            fontSize: "15px",
            animation: "toastSlideIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
          }}
        >
          <span style={{ fontSize: "22px" }}>
            {notif.type === "error" ? "❌" : notif.type === "info" ? "ℹ️" : "✅"}
          </span>
          {notif.text}
        </div>
      )}

      {/* МОДАЛКА СОЗДАНИЯ / РЕДАКТИРОВАНИЯ ЗАЯВКИ */}
      <Modal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title={
          editingId
            ? "Редактировать заявку"
            : modalStep === 1
            ? "🛒 Шаг 1: Выбор материалов"
            : "📝 Шаг 2: Оформление заказа"
        }
        maxWidth={modalStep === 1 ? 760 : 520}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (modalStep === 1) {
              if (selectedMaterialIds.length === 0) {
                showNotification("Выберите хотя бы один материал", "error");
                return;
              }
              setModalStep(2);
            } else {
              void saveRequest();
            }
          }}
        >
          {modalStep === 1 ? (
            /* ================= ШАГ 1: ВИТРИНА КАРТОЧЕК ================= */
            <div>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Номер заявки:</label>
                <input
                  type="text"
                  value={requestNumber}
                  readOnly
                  className="bg-gray-100"
                  style={{ fontSize: "13px", fontWeight: 700 }}
                />
              </div>

              {/* Фильтр по уровням проекта */}
              {levels && levels.length > 0 && (
                <div className="level-filter-container">
                  <div className="level-filter-title">🎯 Уровень / Класс:</div>
                  <div className="level-filter-chips">
                    <button
                      type="button"
                      className={`level-chip ${selectedLevelCode === "all" ? "active" : ""}`}
                      onClick={() => setSelectedLevelCode("all")}
                    >
                      Все уровни
                    </button>
                    {levels.map((lvl) => (
                      <button
                        key={lvl.id}
                        type="button"
                        className={`level-chip ${selectedLevelCode === lvl.code ? "active" : ""}`}
                        onClick={() => setSelectedLevelCode(lvl.code)}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Табы фильтрации витрины */}
              <div className="vitrine-tabs">
                <button
                  type="button"
                  className={`vitrine-tab-btn ${activeTabId === "all" ? "active" : ""}`}
                  onClick={() => setActiveTabId("all")}
                >
                  Все разделы
                </button>
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`vitrine-tab-btn ${activeTabId === t.id ? "active" : ""}`}
                    onClick={() => setActiveTabId(t.id)}
                  >
                    {t.icon || "📁"} {t.title}
                  </button>
                ))}
              </div>

              {/* Сетка материалов */}
              {materialsLoading ? (
                <div style={{ textAlign: "center", padding: "30px", fontWeight: 700 }}>
                  ⏳ Загружаем доступные материалы...
                </div>
              ) : filteredMaterials.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  В этом разделе пока нет материалов
                </div>
              ) : (
                <div className="materials-grid">
                  {filteredMaterials.map((item) => {
                    const isOwned = ownedMaterialSet.has(item.id);
                    const isSelected = selectedMaterialIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`material-card ${isSelected ? "selected" : ""} ${isOwned ? "owned" : ""}`}
                        onClick={() => toggleMaterialSelection(item.id)}
                      >
                        <div className="material-cover-wrapper">
                          {item.cover_image_url ? (
                            <img
                              src={item.cover_image_url}
                              alt={item.title}
                              loading="lazy"
                              className="material-cover-img"
                            />
                          ) : (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontSize: "28px",
                              }}
                            >
                              📖
                            </div>
                          )}
                        </div>

                        <div className="material-card-body">
                          <div className="material-card-title">{item.title}</div>
                          <div className="material-card-footer">
                            <span className="material-card-price">{formatPrice(item.price)}</span>
                            {isOwned ? (
                              <span className="owned-badge">✅ Выдан</span>
                            ) : (
                              <span className={`vitrine-card-btn ${isSelected ? "remove" : "add"}`}>
                                {isSelected ? "✅ Выбрано" : "➕ Выбрать"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Полоса итогов снизу */}
              <div className="cart-summary-bar">
                <div>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Выбрано товаров: </span>
                  <strong style={{ fontSize: "15px", color: "#0f172a" }}>{selectedMaterialIds.length}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>Итого: </span>
                  <strong style={{ fontSize: "18px", color: "var(--project-primary, #6366f1)" }}>
                    {formatPrice(totalPrice)}
                  </strong>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setRequestModalOpen(false)}
                  disabled={busy}
                >
                  ❌ Отмена
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={busy || selectedMaterialIds.length === 0}
                >
                  Далее: Оформление →
                </button>
              </div>
            </div>
          ) : (
            /* ================= ШАГ 2: ИТОГОВЫЙ ЧЕК И ДАННЫЕ ================= */
            <div>
              {/* Чек-смета заказа */}
              <div className="receipt-box">
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: "10px",
                    color: "#0f172a",
                    fontSize: "14px",
                  }}
                >
                  🧾 Ваш состав заказа:
                </div>

                {selectedMaterialsList.map((m) => (
                  <div key={m.id} className="receipt-item">
                    <span>{m.title}</span>
                    <span>{formatPrice(m.price)}</span>
                  </div>
                ))}

                <div className="receipt-total">
                  <span>Итого к оплате:</span>
                  <span style={{ color: "var(--project-primary, #6366f1)" }}>
                    {formatPrice(totalPrice)}
                  </span>
                </div>
              </div>

              {/* Данные покупателя */}
              <div className="form-group">
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>Email (🔒 Из профиля):</label>
                <input type="email" value={userEmail} disabled className="user-locked-field" />
              </div>

              <div className="form-group">
                <label style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>ФИО ученика (🔒 Из профиля):</label>
                <input type="text" value={userFullName} disabled className="user-locked-field" />
              </div>

              <div className="modal-actions" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setModalStep(1)}
                  disabled={busy}
                >
                  ← Назад к выбору
                </button>
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? "Создаем заявку..." : "💳 Оформить и оплатить"}
                </button>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* МОДАЛКА ОПЛАТЫ (QR-КОД) */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="✅ Оплата заявки"
        maxWidth={540}
      >
        <div
          style={{
            background: "color-mix(in srgb, var(--project-primary, #6366f1) 12%, #f8fafc)",
            padding: "18px",
            borderRadius: "14px",
            border: "1px solid color-mix(in srgb, var(--project-primary, #6366f1) 25%, transparent)",
            marginBottom: "20px",
          }}
        >
          <h4
            style={{
              margin: "0 0 10px 0",
              color: "var(--project-primary, #6366f1)",
              fontSize: "16px",
              fontWeight: 800,
            }}
          >
            📋 Инструкция по оплате
          </h4>

          {/* Список всех сгруппированных товаров */}
          {aggregatedPendingSummary.items.length > 0 && (
            <div className="summary-items-list" style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                Заказываемые материалы ({aggregatedPendingSummary.count} заявка/заявок):
              </div>
              {aggregatedPendingSummary.items.map((item, idx) => (
                <div key={idx} className="summary-item" style={{ fontSize: "13px", display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span className="summary-item-title" style={{ fontWeight: 600 }}>{item.title}</span>
                  <span className="summary-item-badge" style={{ fontWeight: 800 }}>
                    {item.count > 1 ? `x${item.count} • ` : ""}
                    {item.unitPrice * item.count} ₽
                  </span>
                </div>
              ))}
            </div>
          )}

          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              color: "#334155",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "14px",
            }}
          >
            <li>
              <strong>Отсканируйте QR-код</strong> в вашем банковском приложении.
            </li>
            <li>
              Сумма к оплате (все неоплаченные заявки):{" "}
              <strong style={{ fontSize: "17px", color: "var(--project-primary, #6366f1)" }}>
                {paymentTotalAmount > 0 ? `${paymentTotalAmount} руб.` : "0 руб."}
              </strong>
            </li>
            <li>
              В назначении платежа (сообщении) <strong>ОБЯЗАТЕЛЬНО</strong> укажите: <br />
              <span
                style={{
                  background: "#ffffff",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  display: "inline-block",
                  marginTop: "6px",
                  border: "1px solid #cbd5e1",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                ФИО ребенка, оплата за учебные материалы
              </span>
            </li>
          </ul>
        </div>

        <div className="qr-head">
          <div className="qr-title">QR-код для перевода</div>
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

        <div
          className="payment-qr payment-qr--smart"
          style={{
            minHeight: "220px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {qrLoading && !qrError ? (
            <div className="qr-loader" role="status">
              <span className="qr-spinner" />
              <div
                className="qr-loader-text"
                style={{ marginTop: "12px", fontWeight: 700 }}
              >
                Загружаем QR-код...
              </div>
            </div>
          ) : null}

          {qrError ? (
            <div className="qr-error" role="alert" style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, marginBottom: 6, color: "#d32f2f" }}>
                Не удалось загрузить QR-код
              </div>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: 12 }}>
                Возможно, файл oplata.png отсутствует на сервере.
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={resetQrStateAndRefresh}
              >
                ↻ Попробовать снова
              </button>
            </div>
          ) : null}

          <img
            key={qrUrl}
            src={qrUrl}
            alt="QR-код для оплаты"
            className={`qr-img`}
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
              maxWidth: "240px",
              margin: "0 auto",
              borderRadius: "16px",
              border: "1px solid rgba(0,0,0,0.1)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
            }}
          />
        </div>

        <div className="modal-actions" style={{ marginTop: "24px" }}>
          <button
            className="btn"
            style={{ width: "100%" }}
            type="button"
            onClick={() => setPaymentModalOpen(false)}
          >
            Я всё оплатил(а)
          </button>
        </div>
      </Modal>

      {/* ОСНОВНОЙ ИНТЕРФЕЙС СТРАНИЦЫ ЗАЯВОК */}
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
            <Link className="nav-pill nav-pill--info" href={`/projects/${project.slug}/profile`}>
              👤 Профиль
            </Link>
            <Link
              className="nav-pill nav-pill--materials"
              href={`/projects/${project.slug}/materials`}
            >
              📚 Материалы
            </Link>
            <Link className="nav-pill nav-pill--logout" href="/portal">
              🏠 Портал
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 style={{ color: "var(--project-primary, #6366f1)", marginBottom: 20 }}>
            📝 Мои заявки на доступы
          </h2>

          <div className="payment-info">
            <h4>💰 Информация об оплате</h4>
            <p>
              Выберите нужные материалы в каталоге. QR-код для оплаты появится сразу после создания
              заявки. После подтверждения оплаты администратором доступ к выбранным материалам
              будет открыт автоматически.
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
                if (aggregatedPendingSummary.count === 0) {
                  showNotification("У вас нет ожидающих оплаты заявок.", "info");
                  return;
                }
                openPaymentModal(aggregatedPendingSummary.totalPrice);
              }}
            >
              💳 Оплатить заявку (QR)
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="empty-state">
              <h3>📭 Заявок пока нет</h3>
              <p>Создайте свою первую заявку на покупку доступа к учебным материалам</p>
              <button className="btn" onClick={openCreate} type="button" disabled={busy}>
                ➕ Создать заявку
              </button>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Номер заявки</th>
                    <th>Дата создания</th>
                    <th>Выбранные материалы</th>
                    <th>Итоговая цена</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const locked = r.is_processed;

                    const matchedMaterials = materials.filter(
                      (m) => r.material_ids && r.material_ids.includes(m.id)
                    );

                    const displayMaterials =
                      matchedMaterials.length > 0
                        ? matchedMaterials.map((m) => m.title).join(", ")
                        : r.material_kinds?.length
                        ? r.material_kinds.join(", ")
                        : r.textbook_types?.length
                        ? r.textbook_types.join(", ")
                        : "—";

                    const price = getRequestPrice(r);

                    return (
                      <tr key={r.id}>
                        <td className="font-bold">{r.request_number}</td>
                        <td>{formatDateTime(r.created_at)}</td>
                        <td>{displayMaterials}</td>
                        <td className="font-bold">
                          {formatPrice(price)}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${
                              r.is_processed ? "status-processed" : "status-pending"
                            }`}
                          >
                            {r.is_processed ? "✅ Выдано" : "⏳ Ожидает"}
                          </span>
                        </td>
                        <td>
                          {locked ? (
                            <span className="text-xs text-gray-400 font-medium italic">
                              🔒 Действия недоступны
                            </span>
                          ) : (
                            <div
                              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
                            >
                              <button
                                className="btn btn-small"
                                onClick={() => openEdit(r)}
                                type="button"
                                disabled={busy}
                              >
                                ✏️ Изменить
                              </button>
                              <button
                                className="btn btn-small secondary"
                                onClick={() => void deleteRequest(r)}
                                type="button"
                                disabled={busy}
                              >
                                🗑️ Удалить
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}