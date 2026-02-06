"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

type UserProgress = { assignment_id: string; is_completed: boolean; score?: number | null };

type TextbookApiOk = {
  ok: true;
  locked: boolean;
  textbook: any;
  assignments?: any[];
  userProgress?: UserProgress[];
};

type TextbookApiErr = { ok: false; error: string };
type TextbookApi = TextbookApiOk | TextbookApiErr;

type Props = {
  textbookId: string;
  initialData: TextbookApiOk | null;
};

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function resolvePublicUrl(raw: any, bucket: string) {
  if (!raw) return null;
  if (isHttpUrl(raw)) return raw;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  const key = String(raw).replace(/^\/+/, "").replace(/^storage\/v1\/object\/public\/[^/]+\//, "");
  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(key)}?v=${Date.now()}`;
}

function guessAssignmentType(assignment: any) {
  const assignmentData = assignment?.content || {};
  const aType = assignmentData?.questions?.[0]?.type || assignment?.type || "test";

  if (aType === "fill") return { icon: "✍️", label: "Ввод ответа", cls: "fill" as const };
  if (aType === "sentence") return { icon: "📝", label: "Заполнение предложения", cls: "sentence" as const };
  return { icon: "📝", label: "Тест", cls: "test" as const };
}

export default function TextbookClient({ textbookId, initialData }: Props) {
  const router = useRouter();

  if (!textbookId) {
    return (
      <div className="textbook-container">
        <div className="error" style={{ display: "block" }}>
          ❌ Некорректная ссылка на учебник
          <div style={{ height: 10 }} />
          <a className="btn" href="/materials">
            ← Назад к материалам
          </a>
        </div>
      </div>
    );
  }

  const [data, setData] = useState<TextbookApiOk | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/textbook-data/${encodeURIComponent(textbookId)}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = (await res.json()) as TextbookApi;

        if (!res.ok || !json.ok) {
          const msg = (json as TextbookApiErr).error || "Не удалось загрузить учебник";
          throw new Error(msg);
        }

        if (cancelled) return;
        setData(json);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || "Ошибка загрузки учебника");
      }
    }

    if (!initialData) load();
    return () => {
      cancelled = true;
    };
  }, [initialData, textbookId]);

  const textbook = data?.textbook ?? null;
  const assignments = data?.assignments ?? [];
  const userProgress = data?.userProgress ?? [];

  const completedSet = useMemo(
    () => new Set(userProgress.filter((x) => x.is_completed).map((x) => x.assignment_id)),
    [userProgress],
  );

  const scoreById = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of userProgress) {
      if (p?.assignment_id && typeof p.score === "number") m.set(p.assignment_id, p.score);
    }
    return m;
  }, [userProgress]);

  const completedCount = userProgress.filter((x) => x.is_completed).length;
  const totalCount = assignments.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const coverUrl = resolvePublicUrl(textbook?.cover_image_url, "covers");

  return (
    <div className="textbook-container">
      <AppHeader
        nav={[
          { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
          { kind: "link", href: "/profile", label: "👤 Профиль", className: "btn" },
          { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
        ]}
      />

      {/* ✅ железобетонно назад в материалы */}
      <div className="back-button">
        <button className="btn secondary" type="button" onClick={() => router.push("/materials")}>
          ← Назад
        </button>
      </div>

      {loading ? (
        <div id="loading" className="loading" style={{ display: "block" }}>
          <div className="spinner"></div>
          <p>Загружаем учебник...</p>
        </div>
      ) : null}

      {error ? (
        <div id="errorMessage" className="error" style={{ display: "block" }}>
          ❌ {error}
          <div style={{ height: 10 }} />
          <button className="btn" onClick={() => location.reload()} type="button">
            🔄 Повторить
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div id="textbookContent" style={{ display: "block" }}>
          {data?.locked ? (
            <div id="lockedMessage" className="locked-message" style={{ display: "block" }}>
              <h3>🔒 Учебник недоступен</h3>
              <p>Для доступа к этому учебнику обратитесь к администратору.</p>
            </div>
          ) : null}

          {!data?.locked && textbook ? (
            <div className="textbook-header" id="textbookHeader" style={{ display: "block" }}>
              <div
                className="textbook-cover"
                id="textbookCover"
                // ✅ FIX: 16:9 и без странной обрезки
                style={{ aspectRatio: "16 / 9", height: "auto" }}
              >
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Обложка учебника"
                    loading="lazy"
                    decoding="async"
                    // ✅ FIX: показываем обложку целиком
                    style={{ objectFit: "contain", objectPosition: "center" }}
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = "none";
                      (img.parentElement as HTMLElement).textContent = "📚";
                    }}
                  />
                ) : (
                  "📚"
                )}
              </div>

              <div className="textbook-info">
                <div className="textbook-title" id="textbookTitle">
                  {textbook.title}
                </div>
                <div className="textbook-description" id="textbookDescription">
                  {textbook.description || "Учебные материалы и задания"}
                </div>

                <div className="progress-stats">
                  <div className="stat-item">
                    <div className="stat-number" id="completedCount">
                      {completedCount}
                    </div>
                    <div className="stat-label">Выполнено</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-number" id="totalCount">
                      {totalCount}
                    </div>
                    <div className="stat-label">Всего заданий</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-number" id="progressPercent">
                      {progressPercent}%
                    </div>
                    <div className="stat-label">Прогресс</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!data?.locked && textbook ? (
            <div className="card" id="assignmentsCard" style={{ display: "block" }}>
              <h3>Задания учебника</h3>
              <p className="small-muted">Нажмите на задание, чтобы пройти его.</p>

              <div className="assignments-list" id="assignmentsList">
                {assignments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                    <p>📝 Задания пока не добавлены</p>
                    <p className="small-muted">Скоро здесь появятся задания для выполнения</p>
                  </div>
                ) : (
                  assignments.map((a: any) => {
                    const isCompleted = completedSet.has(a.id);
                    const meta = guessAssignmentType(a);
                    const score = scoreById.get(a.id);

                    return (
                      <div
                        key={a.id}
                        className={`assignment-item ${isCompleted ? "completed" : ""}`}
                        onClick={() => router.push(`/assignment/${a.id}?source=textbook&sourceId=${textbookId}`)}
                        role="button"
                      >
                        <div className={`assignment-icon ${meta.cls}`}>{meta.icon}</div>

                        <div className="assignment-content">
                          <div className="assignment-title">{a.title}</div>
                          <div className="assignment-type">{meta.label}</div>
                        </div>

                        <div className={`assignment-status ${isCompleted ? "status-completed" : "status-pending"}`}>
                          {isCompleted ? (
                            <>
                              {typeof score === "number" ? <span className="score-pill">{score}%</span> : null}
                              <span>✅ Выполнено</span>
                            </>
                          ) : (
                            <span>⏳ Ожидает</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
