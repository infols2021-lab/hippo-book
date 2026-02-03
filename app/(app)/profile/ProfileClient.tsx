"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import Modal from "@/components/Modal";

type ProfileData = {
  full_name: string;
  contact_phone: string;
  region: string;
  is_admin: boolean;
};

export type Stats = {
  totalMaterials: number;
  completedMaterials: number;
  successRate: number;
  totalAvailableAssignments: number;
  completedAvailableAssignments: number;
};

export type MaterialProgressItem = {
  kind: "textbook" | "crossword";
  id: string;
  title: string;
  completed: number;
  total: number;
  progressPercent: number;
  href: string;
};

type Props = {
  userId: string;
  userEmail: string;
  initialProfile: ProfileData;

  /**
   * Это PNG/JPG фон профиля (на будущее — награды).
   * Если PNG прозрачный — под ним будет виден голубой базовый фон.
   */
  backgroundUrl: string | null;

  // допускаем null/undefined для ленивой загрузки
  stats?: Stats | null;
  materialsProgress?: MaterialProgressItem[] | null;
};

function regionLabel(region: string) {
  return region?.trim() ? region : "Не указана";
}
function phoneLabel(phone: string) {
  return phone?.trim() ? phone : "Не указан";
}
function nameLabel(name: string) {
  return name?.trim() ? name : "Ученик";
}

export default function ProfileClient({
  userId,
  userEmail,
  initialProfile,
  backgroundUrl,
  stats: statsProp,
  materialsProgress: progressProp,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [profile, setProfile] = useState<ProfileData>(initialProfile);

  // background loading indicator
  const [bgLoading, setBgLoading] = useState<boolean>(Boolean(backgroundUrl));
  const [bgReady, setBgReady] = useState<boolean>(false);

  // notification
  const [notif, setNotif] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(profile.full_name ?? "");
  const [editPhone, setEditPhone] = useState(profile.contact_phone ?? "");
  const [editRegion, setEditRegion] = useState(profile.region ?? "");
  const [saving, setSaving] = useState(false);

  // ленивый прогресс
  const [stats, setStats] = useState<Stats | null>(statsProp ?? null);
  const [materialsProgress, setMaterialsProgress] = useState<MaterialProgressItem[] | null>(progressProp ?? null);
  const [progressLoading, setProgressLoading] = useState<boolean>(!statsProp || !progressProp);
  const [progressError, setProgressError] = useState<string | null>(null);

  function showNotification(text: string, type: "success" | "error" = "success") {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  }

  // preload background image
  useEffect(() => {
    if (!backgroundUrl) {
      setBgLoading(false);
      setBgReady(false);
      return;
    }

    setBgLoading(true);
    const img = new Image();
    img.onload = () => {
      setBgLoading(false);
      setBgReady(true);
    };
    img.onerror = () => {
      setBgLoading(false);
      setBgReady(false);
    };
    img.src = backgroundUrl;

    const t = setTimeout(() => setBgLoading(false), 10000);
    return () => clearTimeout(t);
  }, [backgroundUrl]);

  // ленивая загрузка прогресса (через API route)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (statsProp && progressProp) {
        setProgressLoading(false);
        return;
      }

      try {
        setProgressLoading(true);
        setProgressError(null);

        const res = await fetch("/api/profile-progress", { method: "GET", cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || "Не удалось загрузить прогресс");
        }

        if (cancelled) return;

        setStats(json.stats as Stats);
        setMaterialsProgress(json.materialsProgress as MaterialProgressItem[]);
        setProgressLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setProgressLoading(false);
        setProgressError(e?.message || String(e));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [statsProp, progressProp]);

  function openEdit() {
    setEditFullName(profile.full_name || "");
    setEditPhone(profile.contact_phone || "");
    setEditRegion(profile.region || "");
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
  }

  async function saveProfile() {
    const fullName = editFullName.trim();
    const phone = editPhone.trim();
    const region = editRegion;

    if (!fullName || !phone || !region) {
      showNotification("❌ Заполните все поля", "error");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.from("profiles").update({ full_name: fullName, contact_phone: phone, region }).eq("id", userId);
      if (error) throw error;

      setProfile((p) => ({ ...p, full_name: fullName, contact_phone: phone, region }));
      showNotification("✅ Профиль успешно обновлен!");
      closeEdit();
    } catch (e: any) {
      showNotification("❌ Ошибка обновления профиля: " + (e?.message || String(e)), "error");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  }

  const overlayCss =
    backgroundUrl && (bgReady || !bgLoading) ? `url('${backgroundUrl}')` : "none";

  return (
    <div
      id="profileBody"
      style={{
        // PNG кладём поверх базового голубого фона (через CSS var)
        ["--profile-overlay" as any]: overlayCss,
      }}
    >
      {bgLoading ? (
        <div className="background-loading" style={{ display: "block" }}>
          <span className="spinner" />
          Загружаем фон...
        </div>
      ) : null}

      {notif ? (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: notif.type === "success" ? "#4caf50" : "#f44336",
            color: "white",
            padding: "14px 18px",
            borderRadius: 12,
            boxShadow: "0 14px 35px rgba(0,0,0,0.18)",
            zIndex: 10001,
            maxWidth: 360,
            fontWeight: 800,
          }}
        >
          {notif.text}
        </div>
      ) : null}

      <Modal open={editOpen} onClose={closeEdit} title="✏️ Редактирование профиля" maxWidth={520}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          <div className="form-group">
            <label htmlFor="editFullName">ФИО:</label>
            <input
              id="editFullName"
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editPhone">Контактный телефон:</label>
            <input
              id="editPhone"
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="editRegion">Область проживания:</label>
            <select id="editRegion" required value={editRegion} onChange={(e) => setEditRegion(e.target.value)}>
              <option value="">-- Выберите область --</option>
              <option value="Белгородская">Белгородская область</option>
              <option value="Курская">Курская область</option>
              <option value="Тамбовская">Тамбовская область</option>
              <option value="Воронежская">Воронежская область</option>
              <option value="Липецкая">Липецкая область</option>
              <option value="Другое">Другая область</option>
            </select>
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input type="email" value={userEmail} disabled style={{ backgroundColor: "#f5f5f5", color: "#666" }} />
            <div className="small-muted" style={{ marginTop: 5 }}>
              Email нельзя изменить
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={closeEdit}>
              ❌ Отмена
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Сохранение..." : "💾 Сохранить изменения"}
            </button>
          </div>
        </form>
      </Modal>

      <div className="container">
        {/* ===== Topbar like on screenshot ===== */}
        <div className="profile-topbar">
          <div className="brand">
            <div className="brand-mark">EK</div>
            <div>
              <div className="brand-title">Учебники Хиппоши</div>
              <div className="brand-subtitle">☕ Образовательная платформа</div>
            </div>
          </div>

          <div className="top-actions">
            <Link className="nav-pill nav-pill--info" href="/info">
              <span>📄</span>
              Информация
            </Link>
            <Link className="nav-pill nav-pill--materials" href="/materials">
              <span>📚</span>
              Материалы
            </Link>
            <button className="nav-pill nav-pill--logout" type="button" onClick={() => void logout()}>
              <span>⏻</span>
              Выйти
            </button>
          </div>
        </div>

        {/* ===== Main layout ===== */}
        <div className="profile-layout">
          {/* LEFT */}
          <aside className="panel">
            <div className="profile-card">
              <div className="avatar-circle" role="img" aria-label="Профиль ученика">
                <div className="avatar-inner">
                  <div className="avatar-icon">👤</div>
                </div>
              </div>

              <div className="profile-name">{nameLabel(profile.full_name)}</div>
              <div className="profile-email">{userEmail || "—"}</div>

              <div className="profile-mini">
                <div className="mini-col">
                  <div className="mini-cap">
                    <span className="mini-ico">📞</span> ТЕЛЕФОН
                  </div>
                  <div className="mini-val">{phoneLabel(profile.contact_phone)}</div>
                </div>

                <div className="profile-mini-divider" />

                <div className="mini-col">
                  <div className="mini-cap">
                    <span className="mini-ico">📍</span> РЕГИОН
                  </div>
                  <div className="mini-val">{regionLabel(profile.region)}</div>
                </div>
              </div>

              <div className="pill pill--teal">
                <span className="pill-icon">📘</span>
                Доступно заданий: {stats?.totalAvailableAssignments ?? "—"}
              </div>

              <div className="pill pill--red">
                <span className="pill-icon">✅</span>
                Выполнено: {stats?.completedAvailableAssignments ?? "—"}
              </div>

              <button className="action-btn action-btn--primary" onClick={openEdit} type="button">
                <span>✏️</span> Редактировать профиль
              </button>

              {/* Заявки на покупку (оставил, но в аккуратном стиле) */}
              <button
                className="action-btn action-btn--dangerSoft"
                onClick={() => (window.location.href = "/requests")}
                type="button"
              >
                <span>📝</span> Заявки на покупку
              </button>

              {profile.is_admin ? (
                <Link className="action-btn action-btn--soft" href="/admin">
                  <span>⚙️</span> Админка
                </Link>
              ) : null}
            </div>
          </aside>

          {/* RIGHT */}
          <main className="panel">
            {/* Section 1: Stats */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">📊</span>
                Статистика по доступным <b>материалам</b>
              </div>

              <div className="mini-stats">
                <div className="mini-stat">
                  <div className="mini-stat-number">{stats?.totalMaterials ?? "—"}</div>
                  <div className="mini-stat-label">Доступных материала</div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-number">{stats?.completedMaterials ?? "—"}</div>
                  <div className="mini-stat-label">Пройдено материалов</div>
                </div>

                <div className="mini-stat">
                  <div className="mini-stat-number">{stats ? `${stats.successRate}%` : "—"}</div>
                  <div className="mini-stat-label">Общий прогресс</div>
                </div>
              </div>

              {progressLoading ? (
                <div style={{ marginTop: 12, fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>
                  🔄 Подгружаем прогресс...
                </div>
              ) : null}

              {progressError ? (
                <div style={{ marginTop: 12, fontWeight: 900, color: "#c62828" }}>
                  ❌ Прогресс не загрузился: {progressError}
                </div>
              ) : null}
            </section>

            {/* Section 2: Progress */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">📁</span>
                Прогресс по доступным <b>материалам</b>
              </div>

              {!materialsProgress ? (
                <div style={{ fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>📚 Загрузка материалов...</div>
              ) : materialsProgress.length === 0 ? (
                <div style={{ fontWeight: 800, color: "rgba(44,62,80,0.6)" }}>
                  📚 Материалы пока не доступны
                  <div style={{ marginTop: 6, fontWeight: 700 }}>
                    Обратитесь к администратору для получения доступа
                  </div>
                </div>
              ) : (
                <div className="progress-list">
                  {materialsProgress.map((m) => (
                    <div
                      key={`${m.kind}-${m.id}`}
                      className="progress-row"
                      onClick={() => (window.location.href = m.href)}
                    >
                      <div className="progress-left">
                        <div
                          className={
                            "progress-type " +
                            (m.kind === "textbook" ? "progress-type--textbook" : "progress-type--crossword")
                          }
                        >
                          {m.kind === "textbook" ? "📗 УЧЕБНИК" : "🧩 КРОССВОРД"}
                        </div>

                        <div className="progress-title">{m.title}</div>
                        <div className="progress-sub">
                          {m.kind === "textbook"
                            ? `${m.completed} из ${m.total} заданий выполнено`
                            : `${m.completed} из ${m.total} слов отгадано`}
                          {m.total === 0 ? " (нет заданий)" : ""}
                        </div>
                      </div>

                      <div className="progress-right">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${m.progressPercent}%` }} />
                        </div>
                        <div className="progress-percent">{m.progressPercent}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 3: Info */}
            <section className="section">
              <div className="section-title">
                <span className="section-ico">💡</span>
                <b>Информация</b>
              </div>

              <ul className="info-list">
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  На этой странице отображается ваш прогресс по доступным учебникам и кроссвордам.
                </li>
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  В разделе “Прогресс по материалам” показаны все учебники и кроссворды, к которым у вас есть доступ.
                </li>
                <li className="info-li">
                  <span className="info-bullet">▢</span>
                  <span>
                    <b>Совет:</b> регулярно занимайтесь для достижения лучших результатов!
                  </span>
                </li>
              </ul>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
