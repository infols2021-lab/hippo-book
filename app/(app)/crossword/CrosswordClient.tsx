"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

type UserProgress = {
  assignment_id: string;
  is_completed: boolean;
};

type CrosswordApiOk = {
  ok: true;
  locked: boolean;
  crossword: any;
  assignments?: any[];
  userProgress?: UserProgress[];
};

type CrosswordApiErr = {
  ok: false;
  error: string;
};

type CrosswordApi = CrosswordApiOk | CrosswordApiErr;

type Props = {
  crosswordId: string;
  initialData: CrosswordApiOk | null;
};

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function resolvePublicUrl(raw: unknown, bucket: string) {
  if (!raw) return null;

  const value = String(raw).trim();
  if (!value) return null;

  if (value.startsWith("data:")) return value;
  if (value.startsWith("/api/storage/public/")) return value;

  const storageMarker = "/storage/v1/object/public/";

  if (isHttpUrl(value)) {
    const markerIndex = value.indexOf(storageMarker);

    if (markerIndex === -1) return value;

    const rest = value.slice(markerIndex + storageMarker.length).split("?")[0]?.split("#")[0] ?? "";
    const parts = rest.split("/").filter(Boolean);

    const parsedBucket = parts.shift();
    const parsedPath = parts.join("/");

    if (!parsedBucket || !parsedPath) return value;

    return getStoragePublicUrl(parsedBucket, parsedPath);
  }

  const cleaned = value
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

  return getStoragePublicUrl(bucket, cleaned);
}

export default function CrosswordClient({ crosswordId, initialData }: Props) {
  const router = useRouter();
  const invalidCrosswordId = !crosswordId?.trim();

  const [data, setData] = useState<CrosswordApiOk | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData && !invalidCrosswordId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidCrosswordId) return;

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

    if (!initialData) void load();

    return () => {
      cancelled = true;
    };
  }, [initialData, invalidCrosswordId, crosswordId]);

  const crossword = data?.crossword ?? null;
  const assignments = data?.assignments ?? [];
  const userProgress = data?.userProgress ?? [];

  const completedSet = useMemo(
    () => new Set(userProgress.filter((x) => x.is_completed).map((x) => x.assignment_id)),
    [userProgress],
  );

  const completedCount = userProgress.filter((x) => x.is_completed).length;
  const totalCount = assignments.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const coverUrl = resolvePublicUrl(crossword?.cover_image_url, "covers");

  if (invalidCrosswordId) {
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

  return (
    <div className="crossword-container">
      <AppHeader
        nav={[
          { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
          { kind: "link", href: "/profile", label: "👤 Профиль", className: "btn" },
          { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
        ]}
      />

      <div className="back-button">
        <Link className="btn secondary" href="/materials">
          ← Назад
        </Link>
      </div>

      {loading ? (
        <div className="loading" style={{ display: "block" }}>
          <div className="spinner" />
          <p>Загружаем кроссворд...</p>
        </div>
      ) : null}

      {error ? (
        <div className="error" style={{ display: "block" }}>
          ❌ {error}
          <div style={{ height: 10 }} />
          <button className="btn" onClick={() => location.reload()} type="button">
            🔄 Повторить
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div style={{ display: "block" }}>
          {data?.locked ? (
            <div className="locked-message" style={{ display: "block" }}>
              <h3>🔒 Кроссворд недоступен</h3>
              <p>Для доступа к этому кроссворду обратитесь к администратору.</p>
            </div>
          ) : null}

          {!data?.locked && crossword ? (
            <div className="crossword-header" style={{ display: "block" }}>
              <div className="crossword-cover">
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
                <div className="crossword-title">{crossword.title}</div>
                <div className="crossword-description">{crossword.description || "Разгадайте кроссворд"}</div>

                <div className="progress-stats">
                  <div className="stat-item">
                    <div className="stat-number">{completedCount}</div>
                    <div className="stat-label">Разгадано</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-number">{totalCount}</div>
                    <div className="stat-label">Всего слов</div>
                  </div>

                  <div className="stat-item">
                    <div className="stat-number">{progressPercent}%</div>
                    <div className="stat-label">Прогресс</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!data?.locked && crossword ? (
            <div className="card" style={{ display: "block" }}>
              <h3>Слова кроссворда</h3>
              <p className="small-muted">Нажмите на слово, чтобы перейти к заданию.</p>

              <div className="assignments-list">
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
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            router.push(`/assignment/${a.id}?source=crossword&sourceId=${crosswordId}`);
                          }
                        }}
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