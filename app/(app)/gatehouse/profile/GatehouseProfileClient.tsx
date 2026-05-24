// app/(app)/gatehouse/profile/GatehouseProfileClient.tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";

export type GatehouseProfileData = {
  id: string;
  email: string;
  full_name: string;
  contact_phone: string;
  region: string;
};

export type GatehouseProfileStats = {
  totalMaterials: number;
  availableMaterials: number;
  completedAssignments: number;
};

export type GatehouseProfileRecentProgress = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  materialTitle: string;
  score: number;
  completedAt: string | null;
  completedAtLabel: string;
};

type GatehouseProfileClientProps = {
  initialProfile: GatehouseProfileData;
  initialStats: GatehouseProfileStats;
  initialRecentProgress: GatehouseProfileRecentProgress[];
};

type ProfileUpdateApiResponse = {
  ok?: boolean;
  error?: string;
  profile?: {
    id?: string;
    email?: string | null;
    full_name?: string | null;
    contact_phone?: string | null;
    region?: string | null;
  } | null;
};

const REGION_OPTIONS = [
  { value: "Белгородская", label: "Белгородская область" },
  { value: "Курская", label: "Курская область" },
  { value: "Тамбовская", label: "Тамбовская область" },
  { value: "Воронежская", label: "Воронежская область" },
  { value: "Липецкая", label: "Липецкая область" },
  { value: "Другое", label: "Другая область" },
];

function normalizeRegionValue(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const exact = REGION_OPTIONS.find((region) => region.value === raw || region.label === raw);
  if (exact) return exact.value;

  const withoutWord = raw.replace(/\s+область$/i, "").trim();
  const byShort = REGION_OPTIONS.find((region) => region.value === withoutWord);
  if (byShort) return byShort.value;

  if (raw.toLowerCase() === "другая область") return "Другое";

  return raw;
}

function getDisplayName(profile: GatehouseProfileData): string {
  const fullName = profile.full_name.trim();
  if (fullName) return fullName;

  const email = profile.email.trim();
  if (email) return email;

  return "ученик";
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeUiErrorMessage(error: unknown, fallback = "Не удалось выполнить действие") {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : error == null ? "" : String(error);

  const msg = raw.trim();

  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("terminated") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout") ||
    lower.includes("socket") ||
    lower.includes("network")
  ) {
    return "Ошибка соединения с сервером";
  }

  return msg;
}

export default function GatehouseProfileClient({
  initialProfile,
  initialStats,
  initialRecentProgress,
}: GatehouseProfileClientProps) {
  const [profile, setProfile] = useState<GatehouseProfileData>({
    ...initialProfile,
    region: normalizeRegionValue(initialProfile.region),
  });

  const [form, setForm] = useState({
    full_name: initialProfile.full_name,
    contact_phone: initialProfile.contact_phone,
    region: normalizeRegionValue(initialProfile.region),
  });

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const displayName = getDisplayName(profile);

  const hasCurrentRegionOption = !form.region || REGION_OPTIONS.some((region) => region.value === form.region);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      contact_phone: form.contact_phone.trim(),
      region: normalizeRegionValue(form.region),
    };

    if (!payload.full_name) {
      setSaving(false);
      setErrorMessage("Введите ФИО.");
      return;
    }

    try {
      const res = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const json = await safeReadJson<ProfileUpdateApiResponse>(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      const nextProfile: GatehouseProfileData = {
        ...profile,
        full_name: json.profile?.full_name ?? payload.full_name,
        contact_phone: json.profile?.contact_phone ?? payload.contact_phone,
        region: normalizeRegionValue(json.profile?.region ?? payload.region),
      };

      setProfile(nextProfile);
      setForm({
        full_name: nextProfile.full_name,
        contact_phone: nextProfile.contact_phone,
        region: nextProfile.region,
      });

      setSuccessMessage("Профиль обновлён. Эти данные также обновятся в олимпиаде.");
    } catch (error: any) {
      setErrorMessage(normalizeUiErrorMessage(error, "Не удалось сохранить профиль."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="gatehouse-page">
      <div className="gatehouse-container">
        <GatehouseHeader
          title={`Экзамены, ${displayName}`}
          description="Здесь отображаются данные для подготовки к экзаменам Gatehouse Awards."
          backHref="/portal"
          backLabel="Портал"
          actions={[
            {
              href: "/gatehouse/materials",
              label: "Материалы",
            },
            {
              href: "/gatehouse/requests",
              label: "Заявки",
            },
          ]}
        />

        <section className="gatehouse-profile">
          <div className="gatehouse-stats" aria-label="Статистика Gatehouse Awards">
            <article className="gatehouse-stat">
              <span className="gatehouse-stat__value">{initialStats.availableMaterials}</span>
              <span className="gatehouse-stat__label">доступных материалов</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__value">{initialStats.completedAssignments}</span>
              <span className="gatehouse-stat__label">пройденных заданий</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__value">{initialStats.totalMaterials}</span>
              <span className="gatehouse-stat__label">материалов в разделе</span>
            </article>
          </div>

          <div className="gatehouse-profile__grid">
            <section className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Профиль ученика</h2>

                <p className="gatehouse-card__subtitle">
                  ФИО, телефон и регион общие для олимпиады и экзаменов. Если изменить их здесь,
                  они сразу изменятся и в профиле олимпиады.
                </p>

                <form className="gatehouse-form" onSubmit={handleSubmit}>
                  <div className="gatehouse-form__row">
                    <label className="gatehouse-label" htmlFor="gatehouse-email">
                      Email
                    </label>
                    <input id="gatehouse-email" className="gatehouse-input" value={profile.email} disabled readOnly />
                  </div>

                  <div className="gatehouse-form__row">
                    <label className="gatehouse-label" htmlFor="gatehouse-full-name">
                      ФИО
                    </label>
                    <input
                      id="gatehouse-full-name"
                      className="gatehouse-input"
                      value={form.full_name}
                      placeholder="Введите ФИО"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          full_name: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="gatehouse-form__row">
                    <label className="gatehouse-label" htmlFor="gatehouse-phone">
                      Телефон
                    </label>
                    <input
                      id="gatehouse-phone"
                      className="gatehouse-input"
                      value={form.contact_phone}
                      placeholder="+7..."
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          contact_phone: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="gatehouse-form__row">
                    <label className="gatehouse-label" htmlFor="gatehouse-region">
                      Область проживания
                    </label>
                    <select
                      id="gatehouse-region"
                      className="gatehouse-input gatehouse-select"
                      value={form.region}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          region: event.target.value,
                        }))
                      }
                    >
                      <option value="">-- Выберите область --</option>

                      {!hasCurrentRegionOption ? <option value={form.region}>{form.region}</option> : null}

                      {REGION_OPTIONS.map((region) => (
                        <option key={region.value} value={region.value}>
                          {region.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {successMessage ? (
                    <div className="gatehouse-message gatehouse-message--success">{successMessage}</div>
                  ) : null}

                  {errorMessage ? (
                    <div className="gatehouse-message gatehouse-message--error">{errorMessage}</div>
                  ) : null}

                  <button className="gatehouse-button" type="submit" disabled={saving}>
                    {saving ? "Сохраняем..." : "Сохранить профиль"}
                  </button>
                </form>
              </div>
            </section>

            <aside className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Быстрые действия</h2>

                <p className="gatehouse-card__subtitle">
                  Перейдите к материалам или создайте заявку на получение доступа к материалам.
                </p>

                <div className="gatehouse-quick-actions">
                  <Link className="gatehouse-quick-action" href="/gatehouse/materials">
                    <span className="gatehouse-quick-action__main">
                      <span>
                        <span className="gatehouse-quick-action__title">Пробные тесты</span>
                        <span className="gatehouse-quick-action__text">Открыть экзаменационные материалы</span>
                      </span>
                    </span>
                    <span className="gatehouse-quick-action__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>

                  <Link className="gatehouse-quick-action" href="/gatehouse/requests">
                    <span className="gatehouse-quick-action__main">
                      <span>
                        <span className="gatehouse-quick-action__title">Заявки</span>
                        <span className="gatehouse-quick-action__text">Запросить доступ к нужному уровню</span>
                      </span>
                    </span>
                    <span className="gatehouse-quick-action__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>

                  <Link className="gatehouse-quick-action" href="/portal">
                    <span className="gatehouse-quick-action__main">
                      <span>
                        <span className="gatehouse-quick-action__title">Портал</span>
                        <span className="gatehouse-quick-action__text">Вернуться к выбору направления</span>
                      </span>
                    </span>
                    <span className="gatehouse-quick-action__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </div>
            </aside>
          </div>

          <section className="gatehouse-card">
            <div className="gatehouse-card__inner">
              <h2 className="gatehouse-card__title">Последние результаты</h2>

              <p className="gatehouse-card__subtitle">
                Здесь будут отображаться только задания из раздела Gatehouse Awards.
              </p>

              {initialRecentProgress.length > 0 ? (
                <div className="gatehouse-recent">
                  {initialRecentProgress.map((item) => (
                    <article className="gatehouse-recent__item" key={item.id}>
                      <div>
                        <h3 className="gatehouse-recent__title">{item.assignmentTitle}</h3>
                        <p className="gatehouse-recent__meta">
                          {item.materialTitle} · {item.completedAtLabel}
                        </p>
                      </div>
                      <div className="gatehouse-recent__score">{item.score}%</div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="gatehouse-empty">
                  <h3 className="gatehouse-empty__title">Результатов пока нет</h3>
                  <p className="gatehouse-empty__text">
                    When you pass an assignment, your score and further recommendation will be shown here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}