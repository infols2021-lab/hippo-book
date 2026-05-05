"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import MaterialsManagementTab from "./materials/MaterialsManagementTab";
import AssignmentsTab from "./assignments/AssignmentsTab";
import UsersTab from "./users/UsersTab";
import RequestsTab from "./requests/RequestsTab";

type Stats = {
  textbooks: number;
  crosswords: number;
  assignments: number;
  users: number;
};

type ReqStats = { total: number; pending: number; processed: number };

type AdminTab = "materials" | "assignments" | "users" | "requests";

type ApiOkStats = { ok: true; stats: Stats };
type ApiOkReqStats = { ok: true; stats: ReqStats };
type ApiErr = { ok: false; error: string; code?: string };

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function AdminClient() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [loggingOut, setLoggingOut] = useState(false);

  const [tab, setTab] = useState<AdminTab>("materials");

  const [stats, setStats] = useState<Stats>({
    textbooks: 0,
    crosswords: 0,
    assignments: 0,
    users: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState(0);

  const tabs = useMemo(
    () => [
      { key: "materials" as const, label: "📦 Управление материалами" },
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

      if (!res1.ok || !json1) throw new Error(`HTTP ${res1.status}`);
      if (!json1.ok) throw new Error((json1 as ApiErr).error || "Не удалось загрузить статистику");

      setStats(json1.stats);

      if (res2.ok && json2 && (json2 as any).ok) {
        setPendingRequests((json2 as ApiOkReqStats).stats.pending || 0);
      } else {
        setPendingRequests(0);
      }
    } catch (e: any) {
      setStatsErr(e?.message || String(e));
      setStats({ textbooks: 0, crosswords: 0, assignments: 0, users: 0 });
      setPendingRequests(0);
    } finally {
      setLoadingStats(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    const ok = window.confirm("Выйти из аккаунта?");
    if (!ok) return;

    try {
      setLoggingOut(true);
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
      setLoggingOut(false);
    }
  }

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
            <div className="small-muted">Статистика + управление платформой.</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn small" type="button" onClick={() => router.push("/portal")}>
              🏠 Портал
            </button>

            <button className="btn small" type="button" onClick={() => router.push("/profile")}>
              👤 Профиль
            </button>

            <button className="btn small" type="button" onClick={() => void loadStats()}>
              🔄 Обновить статистику
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
              <div className="lbl">Олимп. материалов</div>
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
                padding: "10px 14px",
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                ...(isRequests && pendingRequests > 0
                  ? {
                      border: "2px solid var(--accent)",
                      boxShadow: "0 0 0 4px rgba(255,107,107,0.12)",
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
                    background: "var(--accent)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 900,
                    boxShadow: "0 6px 12px rgba(255,107,107,0.22)",
                  }}
                >
                  {pendingRequests > 99 ? "99" : pendingRequests}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "materials" ? <MaterialsManagementTab onChanged={loadStats} /> : null}
      {tab === "assignments" ? <AssignmentsTab /> : null}
      {tab === "users" ? <UsersTab /> : null}
      {tab === "requests" ? (
        <RequestsTab
          onPendingChanged={(p) => {
            setPendingRequests(p);
          }}
        />
      ) : null}
    </div>
  );
}