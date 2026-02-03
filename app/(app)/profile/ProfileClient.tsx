"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import AppHeader from "@/components/AppHeader";
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

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, contact_phone: phone, region })
        .eq("id", userId);

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

  return (
    <div
      id="profileBody"
      style={{
        backgroundImage: backgroundUrl && (bgReady || !bgLoading) ? `url('${backgroundUrl}')` : undefined,
      }}
    >
      {bgLoading ? (
        <div className="background-loading" style={{ display: "block" }}>
          <span
            className="spinner"
            style={{
              width: 16,
              height: 16,
              borderWidth: 2,
              display: "inline-block",
              verticalAlign: "middle",
              marginRight: 5,
            }}
          />
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
            padding: "15px 20px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10001,
            maxWidth: 320,
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
        <div id="mainContent" style={{ display: "block" }}>
          <AppHeader
            nav={[
              // ✅ Новая кнопка слева от "Материалы"
              { kind: "link", href: "/info", label: "ℹ️ Информация", className: "btn secondary" },
              { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
              { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
            ]}
          />

          <div className="grid-2">
            <div className="card profile-card">
              <div className="profile-avatar" role="img" aria-label="Профиль ученика">
                <div className="profile-avatar-icon">👤</div>
              </div>

              <div className="profile-info">
                <h3 style={{ color: "#2c3e50", marginBottom: 8 }}>{nameLabel(profile.full_name)}</h3>
                <div className="small-muted" style={{ color: "#7f8c8d" }}>
                  {userEmail || "—"}
                </div>

                <div className="user-info-grid">
                  <div className="info-item">
                    <div className="info-label">Телефон</div>
                    <div className="info-value">{phoneLabel(profile.contact_phone)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">Регион</div>
                    <div className="info-value">{regionLabel(profile.region)}</div>
                  </div>
                </div>

                <div className="badges-container">
                  <span className="badge" style={{ background: "var(--accent2)" }}>
                    📊 Доступных заданий: {stats?.totalAvailableAssignments ?? "—"}
                  </span>
                  <span className="badge" style={{ background: "var(--accent)" }}>
                    ✅ Выполнено: {stats?.completedAvailableAssignments ?? "—"}
                  </span>
                </div>

                <button className="edit-profile-btn" onClick={openEdit} type="button">
                  ✏️ Редактировать профиль
                </button>

                <button className="requests-btn" onClick={() => (window.location.href = "/requests")} type="button">
                  📝 Перейти к заявкам на покупку
                </button>

                {profile.is_admin ? (
                  <div style={{ marginTop: 12 }}>
                    <Link className="btn" href="/admin">
                      🛠️ Админка
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="card">
                <h3 style={{ color: "var(--accent2)", marginBottom: 16 }}>📊 Статистика по доступным материалам</h3>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-number">{stats?.totalMaterials ?? "—"}</div>
                    <div className="stat-label">Доступных материалов</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{stats?.completedMaterials ?? "—"}</div>
                    <div className="stat-label">Пройдено материалов</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-number">{stats ? `${stats.successRate}%` : "—"}</div>
                    <div className="stat-label">Общий прогресс</div>
                  </div>
                </div>

                {progressLoading ? (
                  <div style={{ marginTop: 10 }} className="small-muted">
                    🔄 Подгружаем прогресс...
                  </div>
                ) : null}

                {progressError ? (
                  <div style={{ marginTop: 10, color: "#c62828" }} className="small-muted">
                    ❌ Прогресс не загрузился: {progressError}
                  </div>
                ) : null}
              </div>

              <div style={{ height: 18 }} />

              <div className="card">
                <h3 style={{ color: "var(--accent2)", marginBottom: 16 }}>📚 Прогресс по доступным материалам</h3>

                <div className="materials-progress">
                  {!materialsProgress ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
                      <p>📚 Загрузка материалов...</p>
                    </div>
                  ) : materialsProgress.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 20, color: "#666" }}>
                      <p>📚 Материалы пока не доступны</p>
                      <p className="small-muted">Обратитесь к администратору для получения доступа к учебным материалам</p>
                    </div>
                  ) : (
                    materialsProgress.map((m) => (
                      <div
                        key={`${m.kind}-${m.id}`}
                        className="progress-item"
                        style={{ cursor: "pointer" }}
                        onClick={() => (window.location.href = m.href)}
                      >
                        <div className="progress-item-info">
                          <div className="progress-item-title">
                            <span
                              className={`material-type ${m.kind === "textbook" ? "type-textbook" : "type-crossword"}`}
                            >
                              {m.kind === "textbook" ? "📚 УЧЕБНИК" : "🧩 КРОССВОРД"}
                            </span>
                            {m.title}
                          </div>
                          <div className="progress-item-stats">
                            {m.completed} из {m.total} {m.kind === "textbook" ? "заданий выполнено" : "слов отгадано"}
                            {m.total === 0 ? " (нет заданий)" : ""}
                          </div>
                        </div>

                        <div className="progress-bar-mini">
                          <div className="progress-fill-mini" style={{ width: `${m.progressPercent}%` }} />
                        </div>
                        <div className="progress-percentage">{m.progressPercent}%</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ height: 18 }} />

              <div className="card">
                <h3 style={{ color: "var(--accent2)", marginBottom: 16 }}>ℹ️ Информация</h3>
                <p className="small-muted" style={{ color: "#5d4037", lineHeight: 1.5 }}>
                  📈 На этой странице отображается ваш прогресс по доступным учебникам и кроссвордам.
                </p>
                <p className="small-muted" style={{ color: "#5d4037", lineHeight: 1.5 }}>
                  📚 В разделе "Прогресс по материалам" показаны все учебники и кроссворды, к которым у вас есть доступ.
                </p>
                <p className="small-muted" style={{ color: "#5d4037", lineHeight: 1.5 }}>
                  <strong>💡 Совет:</strong> Регулярно занимайтесь для достижения лучших результатов!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
