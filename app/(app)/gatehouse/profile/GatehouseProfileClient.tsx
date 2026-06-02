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

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const displayName = getDisplayName(profile);
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const hasCurrentRegionOption = !form.region || REGION_OPTIONS.some((region) => region.value === form.region);

  function handleCancel() {
    setForm({
      full_name: profile.full_name,
      contact_phone: profile.contact_phone,
      region: profile.region,
    });
    setIsEditing(false);
    setSuccessMessage("");
    setErrorMessage("");
  }

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

      setSuccessMessage("Профиль обновлён. Данные также применены к олимпиаде.");
      setIsEditing(false);
    } catch (error: any) {
      setErrorMessage(normalizeUiErrorMessage(error, "Не удалось сохранить профиль."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="gatehouse-page" style={{ minHeight: '100vh', padding: '24px 0', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#f8fafc' }}>
      <div className="gatehouse-container" style={{ width: '95%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ИСПОЛЬЗУЕМ НАШ НОВЫЙ ЕДИНЫЙ ХЕДЕР */}
        <GatehouseHeader />

        {/* 2-COLUMN LAYOUT */}
        <div className="gatehouse-profile-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* LEFT SIDEBAR */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* PROFILE CARD */}
            <div className="gatehouse-card" style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))', border: '4px solid rgba(99,102,241,0.4)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', fontWeight: 900, color: '#c7d2fe', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                {initials}
              </div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#f8fafc', fontWeight: 800 }}>{displayName}</h2>
              <div style={{ fontSize: '13px', color: '#818cf8', fontWeight: 800, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Студент Gatehouse</div>

              {/* FORM / INFO */}
              {isEditing ? (
                <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>Email</label>
                    <input value={profile.email} disabled readOnly style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', color: '#64748b', fontSize: '14px', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>ФИО</label>
                    <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Введите ФИО" disabled={saving} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.4)', color: '#f8fafc', fontSize: '14px', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>Телефон</label>
                    <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+7..." disabled={saving} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.4)', color: '#f8fafc', fontSize: '14px', outline: 'none' }} />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '6px' }}>Область проживания</label>
                    <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} disabled={saving} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(99,102,241,0.4)', color: '#f8fafc', fontSize: '14px', outline: 'none' }}>
                      <option value="">-- Выберите область --</option>
                      {!hasCurrentRegionOption && <option value={form.region}>{form.region}</option>}
                      {REGION_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  {successMessage && <div style={{ padding: '10px', background: 'rgba(34,197,94,0.15)', color: '#4ade80', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(34,197,94,0.3)' }}>{successMessage}</div>}
                  {errorMessage && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.15)', color: '#f87171', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(239,68,68,0.3)' }}>{errorMessage}</div>}

                  <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: '8px', boxShadow: '0 8px 16px rgba(99,102,241,0.25)' }}>
                    {saving ? "Сохраняем..." : "Сохранить"}
                  </button>
                  <button type="button" onClick={handleCancel} disabled={saving} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>
                    Отмена
                  </button>
                </form>
              ) : (
                <>
                  <div style={{ textAlign: 'left', background: 'rgba(15,23,42,0.5)', padding: '18px', borderRadius: '16px', marginBottom: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.5px' }}>Email</div>
                      <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600, wordBreak: 'break-all' }}>{profile.email}</div>
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.5px' }}>Телефон</div>
                      <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>{profile.contact_phone || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px', letterSpacing: '0.5px' }}>Регион</div>
                      <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>{profile.region || "—"}</div>
                    </div>
                  </div>

                  <button type="button" onClick={() => setIsEditing(true)} style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s' }}>
                    Редактировать профиль
                  </button>
                </>
              )}
            </div>

            {/* SUPPORT CARD */}
            <div className="gatehouse-card" style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '20px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '14px', letterSpacing: '0.5px' }}>Служба поддержки</div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <a href="https://t.me/skebobingg" target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#2AABEE', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 800, fontSize: '13px', display: 'block', boxShadow: '0 4px 12px rgba(42,171,238,0.3)' }}>Telegram</a>
                <a href="https://vk.com/bluntokyr" target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#0077FF', color: 'white', borderRadius: '10px', textDecoration: 'none', fontWeight: 800, fontSize: '13px', display: 'block', boxShadow: '0 4px 12px rgba(0,119,255,0.3)' }}>ВКонтакте</a>
              </div>

              <Link href="/gatehouse/requests" style={{ display: 'block', width: '100%', padding: '12px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', borderRadius: '12px', textDecoration: 'none', fontWeight: 800, fontSize: '14px', boxShadow: '0 8px 20px rgba(239,68,68,0.25)' }}>
                Заявки на покупку
              </Link>
            </div>
          </aside>

          {/* RIGHT MAIN CONTENT */}
          <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* STATS BLOCKS */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', marginTop: 0 }}>Статистика по доступным материалам</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                 <div style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                   <div style={{ fontSize: '38px', fontWeight: 900, color: '#818cf8', marginBottom: '8px', lineHeight: 1 }}>{initialStats.availableMaterials}</div>
                   <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Доступных<br/>материалов</div>
                 </div>
                 <div style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                   <div style={{ fontSize: '38px', fontWeight: 900, color: '#c084fc', marginBottom: '8px', lineHeight: 1 }}>{initialStats.completedAssignments}</div>
                   <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Пройденных<br/>заданий</div>
                 </div>
                 <div style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                   <div style={{ fontSize: '38px', fontWeight: 900, color: '#38bdf8', marginBottom: '8px', lineHeight: 1 }}>{initialStats.totalMaterials}</div>
                   <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Всего материалов<br/>в разделе</div>
                 </div>
              </div>
            </section>

            {/* PROGRESS LIST (RECENT) */}
            <section>
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', marginTop: 0 }}>Последние результаты</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {initialRecentProgress.length > 0 ? (
                  initialRecentProgress.map((item) => (
                    <div key={item.id} style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                       <div style={{ flex: '1 1 200px' }}>
                         <div style={{ display: 'inline-block', padding: '4px 10px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '8px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Пробный тест</div>
                         <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>{item.assignmentTitle}</div>
                         <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{item.materialTitle} <span style={{ opacity: 0.5, margin: '0 4px' }}>•</span> {item.completedAtLabel}</div>
                       </div>
                       
                       <div style={{ width: '100%', maxWidth: '200px', flexShrink: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>Балл</span>
                            <span style={{ fontSize: '18px', fontWeight: 900, color: '#c084fc', lineHeight: 1 }}>{item.score}%</span>
                          </div>
                          <div style={{ width: '100%', height: '10px', background: 'rgba(15,23,42,0.8)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ height: '100%', width: `${item.score}%`, background: 'linear-gradient(90deg, #818cf8, #c084fc)', borderRadius: '999px', transition: 'width 0.5s ease' }} />
                          </div>
                       </div>
                    </div>
                  ))
                ) : (
                  <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '22px', padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                     <div style={{ fontSize: '32px', marginBottom: '12px' }}>📝</div>
                     <div style={{ fontWeight: 800, fontSize: '18px', color: '#cbd5e1', marginBottom: '6px' }}>Результатов пока нет</div>
                     <div style={{ fontSize: '14px', fontWeight: 600 }}>Пройдите доступные пробные тесты, чтобы увидеть свою статистику.</div>
                     <Link href="/gatehouse/materials" style={{ display: 'inline-block', marginTop: '16px', padding: '10px 20px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '10px', textDecoration: 'none', fontWeight: 800, fontSize: '13px' }}>Перейти к материалам</Link>
                  </div>
                )}
              </div>
            </section>

            {/* INFO BLOCK */}
            <section id="info">
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', marginTop: 0 }}>Информация</h3>
              <div style={{ background: 'rgba(30, 41, 59, 0.6)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '22px', padding: '24px 28px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '12px', fontWeight: 500 }}>
                  <li style={{ paddingLeft: '6px' }}>На этой странице отображается ваша статистика по экзаменационным материалам <strong style={{ color: '#f8fafc' }}>Gatehouse Awards</strong>.</li>
                  <li style={{ paddingLeft: '6px' }}>В разделе <strong style={{ color: '#f8fafc' }}>«Последние результаты»</strong> показаны ваши баллы по недавно пройденным пробным тестам.</li>
                  <li style={{ paddingLeft: '6px' }}><strong style={{ color: '#818cf8' }}>Совет:</strong> регулярно практикуйтесь для успешной сдачи экзаменов! Подавайте заявки на новые уровни в соответствующем разделе через кнопку слева.</li>
                </ul>
              </div>
            </section>

          </main>
        </div>
      </div>
    </main>
  );
}