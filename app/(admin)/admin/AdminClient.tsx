"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import Modal from "@/components/Modal";
import Dropzone from "@/components/Admin/ImageOptimizer/Dropzone";
import SettingsPanel from "@/components/Admin/ImageOptimizer/SettingsPanel";
import { processImages } from "@/lib/imageOptimizer";

import ProjectsTab from "./projects/ProjectsTab";
import MaterialsManager from "./projects/MaterialsManager";
import AssignmentsTab from "./assignments/AssignmentsTab";
import UsersTab from "./users/UsersTab";
import RequestsTab from "./requests/RequestsTab";

type Stats = {
  textbooks: number;
  crosswords: number;
  assignments: number;
  users: number;
};

type ReqStats = {
  total: number;
  pending: number;
  processed: number;
};

type AdminTab = "projects" | "materials" | "assignments" | "users" | "requests";

type ApiOkStats = {
  ok: true;
  stats: Stats;
};

type ApiOkReqStats = {
  ok: true;
  stats: ReqStats;
};

type ApiErr = {
  ok: false;
  error: string;
  code?: string;
};

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeUiErrorMessage(error: unknown, fallback = "Произошла ошибка") {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : error == null ? "" : String(error);

  const msg = raw.trim();

  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "Ошибка соединения с сервером";
  }

  return msg;
}

export default function AdminClient() {
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [tab, setTab] = useState<AdminTab>("projects");

  const [stats, setStats] = useState<Stats>({
    textbooks: 0,
    crosswords: 0,
    assignments: 0,
    users: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState(0);

  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [optimizerFiles, setOptimizerFiles] = useState<File[]>([]);
  const [optimizerQuality, setOptimizerQuality] = useState(80);
  const [isProcessing, setIsProcessing] = useState(false);

  const tabs = useMemo(
    () => [
      { key: "projects" as const, label: "📁 Ветки (Проекты)" },
      { key: "materials" as const, label: "📦 Материалы" },
      { key: "assignments" as const, label: "📝 Задания" },
      { key: "users" as const, label: "👥 Пользователи" },
      { key: "requests" as const, label: "📋 Заявки" },
    ],
    [],
  );

  async function loadStats() {
    setLoadingStats(true);
    setStatsErr(null);

    try {
      const [res1, res2] = await Promise.all([
        fetch("/api/admin/stats", { cache: "no-store" }),
        fetch("/api/admin/requests/stats", { cache: "no-store" }),
      ]);

      const json1 = (await safeJson(res1)) as ApiOkStats | ApiErr | null;
      const json2 = (await safeJson(res2)) as ApiOkReqStats | ApiErr | null;

      if (!res1.ok || !json1) {
        throw new Error(`HTTP ${res1.status}`);
      }

      if (!json1.ok) {
        throw new Error((json1 as ApiErr).error || "Не удалось загрузить статистику");
      }

      setStats(json1.stats);

      if (res2.ok && json2 && json2.ok) {
        setPendingRequests(json2.stats.pending || 0);
      } else {
        setPendingRequests(0);
      }
    } catch (e: any) {
      setStatsErr(normalizeUiErrorMessage(e, "Не удалось загрузить статистику"));
      setStats({
        textbooks: 0,
        crosswords: 0,
        assignments: 0,
        users: 0,
      });
      setPendingRequests(0);
    } finally {
      setLoadingStats(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    const confirmed = window.confirm("Выйти из аккаунта?");
    if (!confirmed) return;

    try {
      setLoggingOut(true);

      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      router.push("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  const handleOptimize = async () => {
    if (optimizerFiles.length === 0) return;
    setIsProcessing(true);
    await processImages(optimizerFiles, optimizerQuality);
    setOptimizerFiles([]);
    setIsProcessing(false);
    setIsOptimizerOpen(false);
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const totalLegacyMaterials = Number(stats.textbooks || 0) + Number(stats.crosswords || 0);

  return (
    <div className="admin-container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>⚙️ Панель администратора</h2>
            <div className="small-muted">Управление дата-ориентированной платформой.</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn small" type="button" onClick={() => router.push("/admin/rewards")}>
              🎭 Награды
            </button>

            <button className="btn small" type="button" onClick={() => router.push("/portal")}>
              🏠 Портал
            </button>

            <button className="btn small" type="button" onClick={() => router.push("/profile")}>
              👤 Профиль
            </button>

            <button className="btn small" type="button" onClick={() => void loadStats()}>
              🔄 Обновить статистику
            </button>

            <button
              className="btn small"
              type="button"
              onClick={() => setIsOptimizerOpen(true)}
            >
              🖼️ Сжатие файлов
            </button>

            <button className="btn small secondary" type="button" onClick={() => void logout()} disabled={loggingOut}>
              {loggingOut ? "Выходим..." : "🚪 Выйти"}
            </button>
          </div>
        </div>

        <div style={{ height: 10 }} />

        {loadingStats ? <LoadingBlock text="Загружаем статистику..." /> : null}
        {statsErr ? <ErrorBox message={statsErr} /> : null}

        {!loadingStats && !statsErr ? (
          <div className="admin-stats-grid">
            <div className="admin-stat">
              <div className="num">{totalLegacyMaterials}</div>
              <div className="lbl">Легаси материалов</div>
            </div>

            <div className="admin-stat">
              <div className="num">{stats.textbooks}</div>
              <div className="lbl">Учебников</div>
            </div>

            <div className="admin-stat">
              <div className="num">{stats.crosswords}</div>
              <div className="lbl">Кроссвордов</div>
            </div>

            <div className="admin-stat">
              <div className="num">{stats.assignments}</div>
              <div className="lbl">Заданий</div>
            </div>

            <div className="admin-stat">
              <div className="num">{stats.users}</div>
              <div className="lbl">Пользователей</div>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {tabs.map((t) => {
          const isActive = tab === t.key;
          const isRequests = t.key === "requests";
          const showBadge = isRequests && pendingRequests > 0;

          return (
            <button
              key={t.key}
              type="button"
              className={isActive ? "btn" : "btn ghost"}
              onClick={() => setTab(t.key)}
              style={{
                borderRadius: 14,
                padding: "10px 16px",
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                ...(isRequests && pendingRequests > 0
                  ? {
                      border: "2px solid #ef4444",
                      boxShadow: "0 0 0 4px rgba(239, 68, 68, 0.15)",
                    }
                  : {}),
              }}
            >
              {t.label}

              {showBadge ? (
                <span
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "#ef4444",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    boxShadow: "0 4px 10px rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {pendingRequests > 99 ? "99" : pendingRequests}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "projects" ? <ProjectsTab /> : null}
      {tab === "materials" ? <MaterialsManager /> : null}
      {tab === "assignments" ? <AssignmentsTab /> : null}
      {tab === "users" ? <UsersTab /> : null}
      {tab === "requests" ? <RequestsTab onPendingChanged={(p) => setPendingRequests(p)} /> : null}

      <Modal
        open={isOptimizerOpen}
        onClose={() => {
          setIsOptimizerOpen(false);
          setOptimizerFiles([]);
        }}
        title="🖼️ Сжатие изображений в WebP"
        maxWidth={720}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <SettingsPanel quality={optimizerQuality} setQuality={setOptimizerQuality} />
          <Dropzone files={optimizerFiles} setFiles={setOptimizerFiles} />

          {optimizerFiles.length > 0 && (
            <button
              onClick={handleOptimize}
              disabled={isProcessing}
              className="btn"
              style={{
                width: "100%",
                marginTop: "1rem",
                background: isProcessing ? "#475569" : "linear-gradient(135deg, #0ea5e9, #0284c7)",
              }}
            >
              {isProcessing ? "⚡ Обработка и сжатие..." : "Скачать готовый ZIP архив"}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}