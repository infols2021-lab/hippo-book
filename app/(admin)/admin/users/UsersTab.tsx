"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

import UserAccessModal from "./UserAccessModal";

/* ================= TYPES ================= */

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_phone: string | null;
  region: string | null;
  is_admin: boolean | null;
  created_at: string | null;
  hasMaterials?: boolean;
};

type UsersApiOk = {
  ok: true;
  users: UserRow[];
  stats: { total: number; withMaterials: number };
};

type ApiErr = { ok: false; error: string; code?: string };

/* ================= HELPERS ================= */

async function safeJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/* ================= COMPONENT ================= */

export default function UsersTab() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState({ total: 0, withMaterials: 0 });

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [materialsFilter, setMaterialsFilter] = useState<"" | "has" | "none">("");

  /* pending requests → подсветка строк */
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(new Set());

  /* modal */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<UserRow | null>(null);

  /* ================= DATA ================= */

  async function fetchPendingUserIds(): Promise<Set<string>> {
    try {
      const res = await fetch("/api/admin/requests?status=pending", { cache: "no-store" });
      const json = (await safeJson(res)) as
        | { ok: true; requests: Array<{ user_id: string }> }
        | ApiErr
        | null;

      if (!res.ok || !json || !("ok" in json) || !json.ok) return new Set();

      const ids = new Set<string>();
      for (const r of json.requests ?? []) {
        if (r?.user_id) ids.add(String(r.user_id));
      }
      return ids;
    } catch {
      return new Set();
    }
  }

  async function loadUsers() {
    setLoading(true);
    setErr(null);

    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("q", search.trim());
      if (region) qs.set("region", region);
      if (materialsFilter) qs.set("materials", materialsFilter);

      // Параллельная загрузка пользователей и активных заявок без фликера
      const [usersRes, pendingIds] = await Promise.all([
        fetch(`/api/admin/users?${qs.toString()}`, { cache: "no-store" }),
        fetchPendingUserIds(),
      ]);

      const json = (await safeJson(usersRes)) as UsersApiOk | ApiErr | null;

      if (!usersRes.ok || !json) throw new Error(`HTTP ${usersRes.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || `HTTP ${usersRes.status}`);

      setUsers(json.users ?? []);
      setStats(json.stats ?? { total: 0, withMaterials: 0 });
      setPendingUserIds(pendingIds);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setUsers([]);
      setStats({ total: 0, withMaterials: 0 });
      setPendingUserIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  /* ================= EFFECTS ================= */

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, materialsFilter]);

  useEffect(() => {
    const t = setTimeout(() => void loadUsers(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const rows = useMemo(() => users, [users]);

  /* ================= UI ================= */

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0 }}>👥 Пользователи</h3>
          <div className="small-muted">Поиск, фильтры и управление доступами.</div>
        </div>

        <button className="btn small" type="button" onClick={() => void loadUsers()}>
          🔄 Обновить
        </button>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="admin-stat">
          <div className="num">{stats.total}</div>
          <div className="lbl">Всего</div>
        </div>
        <div className="admin-stat">
          <div className="num">{stats.withMaterials}</div>
          <div className="lbl">С материалами</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <input
          className="input"
          placeholder="Поиск (ФИО / Email / Телефон)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Все регионы</option>
          <option value="Белгородская">Белгородская</option>
          <option value="Воронежская">Воронежская</option>
          <option value="Курская">Курская</option>
          <option value="Тамбовская">Тамбовская</option>
          <option value="Липецкая">Липецкая</option>
          <option value="Другое">Другое</option>
        </select>

        <select
          className="input"
          value={materialsFilter}
          onChange={(e) => setMaterialsFilter(e.target.value as "" | "has" | "none")}
        >
          <option value="">Все</option>
          <option value="has">С материалами</option>
          <option value="none">Без материалов</option>
        </select>
      </div>

      <div style={{ height: 14 }} />

      {loading ? <LoadingBlock text="Загружаем пользователей..." /> : null}
      {err ? <ErrorBox message={err} /> : null}

      {!loading && !err ? (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>#</th>
                <th>ФИО</th>
                <th>Email</th>
                <th>Телефон</th>
                <th>Регион</th>
                <th>Материалы</th>
                <th>Роль</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 16, textAlign: "center" }}>
                    <div className="small-muted" style={{ fontWeight: 800 }}>
                      Пользователи не найдены
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((u, idx) => {
                  const hasPending = pendingUserIds.has(u.id);

                  return (
                    <tr
                      key={u.id}
                      style={
                        hasPending
                          ? {
                              outline: "2px solid rgba(255,107,107,.8)",
                              outlineOffset: -2,
                              background: "rgba(255,107,107,.05)",
                            }
                          : undefined
                      }
                    >
                      <td>
                        <strong>{rows.length - idx}</strong>
                      </td>

                      <td>
                        <strong>{u.full_name || "—"}</strong>
                        {hasPending ? (
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 900, color: "#d32f2f" }}>
                            ⚠️ есть заявка
                          </span>
                        ) : null}
                      </td>

                      <td>{u.email || "—"}</td>
                      <td>{u.contact_phone || "—"}</td>
                      <td>{u.region || "—"}</td>
                      <td>{u.hasMaterials ? "✅" : "—"}</td>
                      <td>{u.is_admin ? "👑 Админ" : "👤 Пользователь"}</td>

                      <td>
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => {
                            setModalUser(u);
                            setModalOpen(true);
                          }}
                        >
                          🔐 Материалы
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ===== MODAL ===== */}
      <UserAccessModal
        open={modalOpen}
        user={modalUser}
        onClose={() => {
          setModalOpen(false);
          setModalUser(null);
        }}
        onSaved={async () => {
          setModalOpen(false);
          setModalUser(null);
          await loadUsers();
        }}
      />
    </div>
  );
}