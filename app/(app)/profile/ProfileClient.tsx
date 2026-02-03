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

  const hasBg = Boolean(backgroundUrl && (bgReady || !bgLoading));
  const bgStyle = hasBg ? { backgroundImage: `url('${backgroundUrl}')` } : undefined;

  return (
    <div id="profileBody" className={hasBg ? "pf-hasBg" : ""} style={bgStyle}>
      {bgLoading ? (
        <div className="pf-background-loading">
          <span className="pf-spinner" />
          Загружаем фон...
        </div>
      ) : null}

      {notif ? (
        <div
          className="pf-toast"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
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
          <div className="pf-formGroup">
            <label htmlFor="editFullName">ФИО:</label>
            <input
              id="editFullName"
              type="text"
              required
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
            />
          </div>

          <div className="pf-formGroup">
            <label htmlFor="editPhone">Контактный телефон:</label>
            <input
              id="editPhone"
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>

          <div className="pf-formGroup">
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

          <div className="pf-formGroup">
            <label>Email:</label>
            <input
              type="email"
              value={userEmail}
              disabled
              style={{ backgroundColor: "rgba(245,248,255,0.9)", color: "#64748b" }}
            />
            <div className="pf-muted" style={{ marginTop: 6 }}>
              Email нельзя изменить
            </div>
          </div>

          <div className="pf-modalActions">
            <button type="button" className="btn secondary" onClick={closeEdit}>
              ❌ Отмена
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? "Сохранение..." : "💾 Сохранить изменения"}
            </button>
          </div>
        </form>
      </Modal>

      <div className="pf-shell">
        <AppHeader
          nav={[
            { kind: "link", href: "/info", label: "ℹ️ Информация", className: "btn secondary" },
            { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
            { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
          ]}
        />

        <div className="pf-main">
          {/* LEFT: PROFILE */}
          <div className="pf-card">
            <div className="pf-card-inner">
              <div className="pf-profileTop">
                <div className="pf-avatar" role="img" aria-label="Профиль ученика">
                  <div className="pf-avatarIcon">👤</div>
                </div>

                <div>
                  <h2 className="pf-name">{nameLabel(profile.full_name)}</h2>
                  <p className="pf-email">{userEmail || "—"}</p>

                  <div className="pf-pills">
                    <span className="pf-pill">📊 Доступных заданий: {stats?.totalAvailableAssignments ?? "—"}</span>
                    <span className="pf-pill">✅ Выполнено: {stats?.completedAvailableAssignments ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div className="pf-infoGrid">
                <div className="pf-infoItem">
                  <div className="pf-infoLabel">Телефон</div>
                  <div className="pf-infoValue">{phoneLabel(profile.contact_phone)}</div>
                </div>
                <div className="pf-infoItem">
                  <div className="pf-infoLabel">Регион</div>
                  <div className="pf-infoValue">{regionLabel(profile.region)}</div>
                </div>
              </div>

              <div className="pf-actions">
                <div className="pf-actionsRow">
                  <button className="btn" onClick={openEdit} type="button">
                    ✏️ Редактировать
                  </button>
                  <button className="btn secondary" onClick={() => (window.location.href = "/requests")} type="button">
                    📝 Заявки
                  </button>
                </div>

                {profile.is_admin ? (
                  <Link className="btn secondary" href="/admin">
                    🛠️ Админка
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {/* RIGHT: STATS + HINT */}
          <div className="pf-rightStack">
            <div className="pf-card">
              <div className="pf-card-inner">
                <h3 className="pf-title">📊 Статистика по доступным материалам</h3>

                <div className="pf-statsGrid">
                  <div className="pf-stat">
                    <div className="pf-statNum">{stats?.totalMaterials ?? "—"}</div>
                    <div className="pf-statLabel">Доступных материалов</div>
                  </div>

                  <div className="pf-stat">
                    <div className="pf-statNum">{stats?.completedMaterials ?? "—"}</div>
                    <div className="pf-statLabel">Пройдено материалов</div>
                  </div>

                  <div className="pf-stat">
                    <div className="pf-statNum">{stats ? `${stats.successRate}%` : "—"}</div>
                    <div className="pf-statLabel">Общий прогресс</div>
                  </div>
                </div>

                {progressLoading ? (
                  <div className="pf-muted" style={{ marginTop: 10 }}>
                    🔄 Подгружаем прогресс...
                  </div>
                ) : null}

                {progressError ? (
                  <div className="pf-muted" style={{ marginTop: 10, color: "#b42318", fontWeight: 850 }}>
                    ❌ Прогресс не загрузился: {progressError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pf-card">
              <div className="pf-card-inner">
                <h3 className="pf-title">💡 Подсказка</h3>
                <div className="pf-muted" style={{ lineHeight: 1.55 }}>
                  <p style={{ margin: "8px 0" }}>✅ Здесь отображается ваш прогресс по учебникам и кроссвордам.</p>
                  <p style={{ margin: "8px 0" }}>📚 Ниже — все материалы, которые вам открыты, с прогрессом выполнения.</p>
                  <p style={{ margin: "8px 0" }}>
                    🌟 Совет: лучше проходить понемногу каждый день — так результат растёт быстрее.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS LIST */}
        <div style={{ height: 16 }} />

        <div className="pf-card">
          <div className="pf-card-inner">
            <h3 className="pf-title">📚 Прогресс по доступным материалам</h3>

            {!materialsProgress ? (
              <div className="pf-muted" style={{ padding: 10 }}>
                📚 Загрузка материалов...
              </div>
            ) : materialsProgress.length === 0 ? (
              <div className="pf-muted" style={{ padding: 10 }}>
                <p style={{ margin: 0, fontWeight: 900 }}>Материалы пока не доступны</p>
                <p style={{ margin: "8px 0 0" }}>Обратитесь к администратору для получения доступа</p>
              </div>
            ) : (
              <div className="pf-progressList">
                {materialsProgress.map((m) => (
                  <div
                    key={`${m.kind}-${m.id}`}
                    className="pf-progressItem"
                    onClick={() => (window.location.href = m.href)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") window.location.href = m.href;
                    }}
                  >
                    <div>
                      <p className="pf-progressTitle">
                        <span className={`pf-tag ${m.kind === "textbook" ? "textbook" : "crossword"}`}>
                          {m.kind === "textbook" ? "📚 УЧЕБНИК" : "🧩 КРОССВОРД"}
                        </span>
                        {m.title}
                      </p>
                      <p className="pf-progressSub">
                        {m.completed} из {m.total} {m.kind === "textbook" ? "заданий выполнено" : "слов отгадано"}
                        {m.total === 0 ? " (нет заданий)" : ""}
                      </p>
                    </div>

                    <div className="pf-bar">
                      <div className="pf-barFill" style={{ width: `${m.progressPercent}%` }} />
                    </div>

                    <div className="pf-percent">{m.progressPercent}%</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
