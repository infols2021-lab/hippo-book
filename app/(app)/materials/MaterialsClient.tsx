"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import AppHeader from "@/components/AppHeader";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

type Textbook = any;
type Crossword = any;
type Assignment = { id: string; textbook_id: string | null; crossword_id: string | null };
type UserProgress = { assignment_id: string; is_completed: boolean };

type MaterialsData = {
  textbooks: Textbook[];
  crosswords: Crossword[];
  assignments: Assignment[];
  userProgress: UserProgress[];
  textbookAccess: { textbook_id: string }[];
  crosswordAccess: { crossword_id: string }[];
};

type Props = {
  initialData: MaterialsData | null;
};

function computeProgress(
  kind: "textbook" | "crossword",
  id: string,
  assignments: Assignment[],
  completedSet: Set<string>
) {
  const ids =
    kind === "textbook"
      ? assignments.filter((a) => a.textbook_id === id).map((a) => a.id)
      : assignments.filter((a) => a.crossword_id === id).map((a) => a.id);

  const total = ids.length;
  let completed = 0;
  for (const x of ids) if (completedSet.has(x)) completed++;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  return { total, completed, progress };
}

export default function MaterialsClient({ initialData }: Props) {
  const router = useRouter();
  useMemo(() => getSupabaseBrowserClient(), []); // оставлено чтобы не терять паттерн, но тут не нужно

  const [tab, setTab] = useState<"textbooks" | "crosswords">("textbooks");

  const [data, setData] = useState<MaterialsData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/materials-data", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить материалы");

        if (cancelled) return;
        setData(json as MaterialsData);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || String(e));
      }
    }

    if (!initialData) load();
    return () => {
      cancelled = true;
    };
  }, [initialData]);

  useEffect(() => {
    const hash = window.location.hash || "";
    if (!hash) return;

    if (hash.startsWith("#textbook-")) {
      setTab("textbooks");
      setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    }
    if (hash.startsWith("#crossword-")) {
      setTab("crosswords");
      setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, []);

  return (
    <div className="materials-container">
      <AppHeader
  nav={[
    { kind: "link", href: "/profile", label: "Профиль", className: "btn" },
    { kind: "logout", label: "Выйти", className: "btn secondary" },
  ]}
      />

      <div className="materials-tabs">
        <button
          className={`material-tab ${tab === "textbooks" ? "active" : ""}`}
          onClick={() => setTab("textbooks")}
          type="button"
        >
          📚 Учебники
        </button>
        <button
          className={`material-tab ${tab === "crosswords" ? "active" : ""}`}
          onClick={() => setTab("crosswords")}
          type="button"
        >
          🧩 Кроссворды
        </button>
      </div>

      {loading ? <LoadingBlock text="Загружаем материалы..." /> : null}
      {error ? <ErrorBox message={error} /> : null}

      {!loading && !error && data ? (
        <>
          <div className={`materials-section ${tab === "textbooks" ? "active" : ""}`} id="textbooks-section">
            <h3>Доступные учебники</h3>
            <p className="small-muted">Выберите учебник для изучения материалов и выполнения заданий</p>

            <div className="materials-grid">
              {(() => {
                const completedSet = new Set(
                  (data.userProgress || []).filter((x) => x.is_completed).map((x) => x.assignment_id)
                );
                const access = new Set((data.textbookAccess || []).map((x) => x.textbook_id));
                const available = (data.textbooks || []).filter((t: any) => t.is_available || access.has(t.id));
                const locked = (data.textbooks || []).filter((t: any) => !t.is_available && !access.has(t.id));

                if (available.length === 0) {
                  return (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#666" }}>
                      <p>📚 Учебники пока не доступны</p>
                      <p className="small-muted">Ожидайте, когда администратор предоставит доступ</p>
                    </div>
                  );
                }

                return (
                  <>
                    {available.map((t: any) => {
                      const { total, completed, progress } = computeProgress(
                        "textbook",
                        t.id,
                        data.assignments,
                        completedSet
                      );

                      return (
                        <div
                          key={t.id}
                          id={`textbook-${t.id}`}
                          className="material-card"
                          onClick={() => router.push(`/textbook/${t.id}`)}
                          role="button"
                        >
                          <div className="material-cover">
                            {t.cover_image_url ? (
                              <img
                                src={t.cover_image_url}
                                alt={t.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                  (img.parentElement as HTMLElement).innerHTML = "📚";
                                }}
                              />
                            ) : (
                              "📚"
                            )}
                          </div>

                          <div className="material-title">{t.title}</div>
                          <div className="material-description">{t.description || "Учебные материалы и задания"}</div>

                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                          </div>

                          <div className="material-stats">
                            <span>
                              {completed}/{total} заданий
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                        </div>
                      );
                    })}

                    {locked.map((t: any) => (
                      <div key={t.id} className="material-card locked">
                        <div className="material-cover" style={{ filter: "grayscale(100%)", opacity: 0.6 }}>
                          {t.cover_image_url ? (
                            <img
                              src={t.cover_image_url}
                              alt={t.title}
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                            />
                          ) : (
                            "📚"
                          )}
                        </div>
                        <div className="material-title" style={{ color: "#999" }}>
                          {t.title}
                        </div>
                        <div className="material-description" style={{ color: "#999" }}>
                          {t.description || "Учебные материалы и задания"}
                        </div>
                        <div className="locked-overlay">🔒 Недоступен</div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>

          <div className={`materials-section ${tab === "crosswords" ? "active" : ""}`} id="crosswords-section">
            <h3>Доступные кроссворды</h3>
            <p className="small-muted">Разгадывайте кроссворды для закрепления знаний</p>

            <div className="materials-grid">
              {(() => {
                const completedSet = new Set(
                  (data.userProgress || []).filter((x) => x.is_completed).map((x) => x.assignment_id)
                );
                const access = new Set((data.crosswordAccess || []).map((x) => x.crossword_id));
                const available = (data.crosswords || []).filter((c: any) => c.is_available || access.has(c.id));
                const locked = (data.crosswords || []).filter((c: any) => !c.is_available && !access.has(c.id));

                if (available.length === 0) {
                  return (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "#666" }}>
                      <p>🧩 Кроссворды пока не доступны</p>
                      <p className="small-muted">Ожидайте, когда администратор предоставит доступ</p>
                    </div>
                  );
                }

                return (
                  <>
                    {available.map((c: any) => {
                      const { total, completed, progress } = computeProgress(
                        "crossword",
                        c.id,
                        data.assignments,
                        completedSet
                      );

                      return (
                        <div
                          key={c.id}
                          id={`crossword-${c.id}`}
                          className="material-card"
                          onClick={() => router.push(`/crossword/${c.id}`)}
                          role="button"
                        >
                          <div className="material-cover">
                            {c.cover_image_url ? (
                              <img
                                src={c.cover_image_url}
                                alt={c.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  img.style.display = "none";
                                  (img.parentElement as HTMLElement).innerHTML = "🧩";
                                }}
                              />
                            ) : (
                              "🧩"
                            )}
                          </div>

                          <div className="material-title">{c.title}</div>
                          <div className="material-description">{c.description || "Разгадайте кроссворд"}</div>

                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                          </div>

                          <div className="material-stats">
                            <span>
                              {completed}/{total} слов
                            </span>
                            <span>{Math.round(progress)}%</span>
                          </div>
                        </div>
                      );
                    })}

                    {locked.map((c: any) => (
                      <div key={c.id} className="material-card locked">
                        <div className="material-cover" style={{ filter: "grayscale(100%)", opacity: 0.6 }}>
                          {c.cover_image_url ? (
                            <img
                              src={c.cover_image_url}
                              alt={c.title}
                              style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                            />
                          ) : (
                            "🧩"
                          )}
                        </div>
                        <div className="material-title" style={{ color: "#999" }}>
                          {c.title}
                        </div>
                        <div className="material-description" style={{ color: "#999" }}>
                          {c.description || "Разгадайте кроссворд"}
                        </div>
                        <div className="locked-overlay">🔒 Недоступен</div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
