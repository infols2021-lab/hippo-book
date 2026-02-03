"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserProgress = { assignment_id: string; is_completed: boolean };

type CrosswordApiOk = {
  ok: true;
  locked: boolean;
  crossword: any;
  assignments?: any[];
  userProgress?: UserProgress[];
};

type CrosswordApiErr = { ok: false; error: string };
type CrosswordApi = CrosswordApiOk | CrosswordApiErr;

type Props = {
  crosswordId: string;
  initialData: CrosswordApiOk | null;
};

function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function resolvePublicUrl(raw: any, bucket: string) {
  if (!raw) return null;
  if (isHttpUrl(raw)) return raw;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  const key = String(raw)
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

  const v = Date.now();
  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(key)}?v=${v}`;
}

export default function CrosswordClient({ crosswordId, initialData }: Props) {
  const router = useRouter();

  if (!crosswordId) {
    return (
      <div className="crossword-container">
        <div className="error" style={{ display: "block" }}>
          ❌ Некорректная ссылка на кроссворд
          <div style={{ height: 10 }} />
          <a className="btn" href="/materials">
            ← Назад к материалам
          </a>
        </div>
      </div>
    );
  }

  const [data, setData] = useState<CrosswordApiOk | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/crossword-data/${encodeURIComponent(crosswordId)}`, {
          method: "GET",
          cache: "no-store",
        });
        const json = (await res.json()) as CrosswordApi;

        if (!res.ok || !json.ok) {
          const msg = (json as CrosswordApiErr).error || "Не удалось загрузить кроссворд";
          throw new Error(msg);
        }

        if (cancelled) return;
        setData(json);
        setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoading(false);
        setError(e?.message || "Ошибка загрузки кроссворда");
      }
    }

    if (!initialData) load();
    return () => {
      cancelled = true;
    };
  }, [initialData, crosswordId]);

  const crossword = data?.crossword ?? null;
  const assignments = data?.assignments ?? [];
  const userProgress = data?.userProgress ?? [];

  const completedSet = useMemo(
    () => new Set(userProgress.filter((x) => x.is_completed).map((x) => x.assignment_id)),
    [userProgress]
  );

  const completedCount = userProgress.filter((x) => x.is_completed).length;
  const totalCount = assignments.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ✅ cover как у учебника (но bucket отдельный)
  // Если у тебя cover лежит в другом бакете — поменяй "covers" на нужный.
  const coverUrl = resolvePublicUrl(crossword?.cover_image_url, "covers");

  return (
    <div className="crossword-container">
      {/* ✅ как в учебниках */}
      <div className="back-button">
        <Link className="btn secondary" href="/materials">
          ← Назад к материалам
        </Link>
      </div>

      {loading ? (
        <div id="loading" className="loading" style={{ display: "block" }}>
          <div className="spinner"></div>
          <p>Загружаем кроссворд...</p>
        </div>
      ) : null}

      {error ? (
        <div id="errorMessage" className="error" style={{ display: "block" }}>
          ❌ {error}
          <div style={{ height: 10 }} />
          <button className="btn" onClick={() => location.reload()}>
            🔄 Повторить
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div id="crosswordContent" style={{ display: "block" }}>
          {data?.locked ? (
            <div id="lockedMessage" className="locked-message" style={{ display: "block" }}>
              <h3>🔒 Кроссворд недоступен</h3>
              <p>Для доступа к этому кроссворду обратитесь к администратору.</p>
            </div>
          ) : null}

          {!data?.locked && crossword ? (
            <div className="crossword-header" id="crosswordHeader" style={{ display: "block" }}>
              {/* ✅ обложка как в учебнике */}
              <div className="crossword-cover" id="crosswordCover">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Обложка кроссворда"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = "none";
                      (img.parentElement as HTMLElement).textContent = "🧩";
                    }}
                  />
                ) : (
                  "🧩"
                )}
              </div>

              <div className="crossword-info">
                <div className="crossword-title" id="crosswordTitle">
                  {crossword.title}
                </div>
                <div className="crossword-description" id="crosswordDescription">
                  {crossword.description || "Разгадайте кроссворд"}
                </div>

                <div className="progress-stats">
                  <div className="stat-item">
                    <div className="stat-number" id="completedCount">
                      {completedCount}
                    </div>
                    <div className="stat-label">Разгадано</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-number" id="totalCount">
                      {totalCount}
                    </div>
                    <div className="stat-label">Всего слов</div>
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

          {!data?.locked && crossword ? (
            <div className="card" id="assignmentsCard" style={{ display: "block" }}>
              <h3>Слова кроссворда</h3>
              <p className="small-muted">Нажмите на слово, чтобы перейти к заданию.</p>

              <div className="assignments-list" id="assignmentsList">
                {assignments.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                    <p>🧩 Слова пока не добавлены</p>
                    <p className="small-muted">Скоро здесь появятся слова для разгадывания</p>
                  </div>
                ) : (
                  assignments.map((a: any) => {
                    const isCompleted = completedSet.has(a.id);

                    return (
                      <div
                        key={a.id}
                        className={`assignment-item ${isCompleted ? "completed" : ""}`}
                        onClick={() => router.push(`/assignment/${a.id}?source=crossword&sourceId=${crosswordId}`)}
                        role="button"
                      >
                        <div className="assignment-icon">🧩</div>

                        <div className="assignment-content">
                          <div className="assignment-title">{a.title}</div>
                          <div className="assignment-type">Слово кроссворда</div>
                        </div>

                        <div className={`assignment-status ${isCompleted ? "status-completed" : "status-pending"}`}>
                          {isCompleted ? "✅ Разгадано" : "⏳ Ожидает"}
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
