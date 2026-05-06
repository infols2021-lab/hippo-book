"use client";

import { useEffect, useRef, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

type Props = {
  onChanged?: () => void | Promise<void>;
};

type CrosswordRow = {
  id: string;
  title: string;
  description: string | null;
  class_level: string[] | null;
  cover_image_url: string | null;
  order_index: number | null;
  is_available: boolean | null;
  is_active: boolean | null;
  assignments_count?: number | null;
  assignment_count?: number | null;
  assignmentsCount?: number | null;
  _count?: {
    assignments?: number | null;
  } | null;
};

type AssignmentLike = {
  id?: string;
  crossword_id?: string | null;
  crosswordId?: string | null;
};

type UploadApiResponse = {
  ok?: boolean;
  error?: string;
  url?: string | null;
  publicUrl?: string | null;
  imageUrl?: string | null;
  path?: string | null;
  bucket?: string | null;
  data?: {
    url?: string | null;
    publicUrl?: string | null;
    imageUrl?: string | null;
    path?: string | null;
    bucket?: string | null;
  } | null;
};

const CLASS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "1-2", label: "1-2 класс" },
  { value: "3-4", label: "3-4 класс" },
  { value: "5-6", label: "5-6 класс" },
  { value: "7", label: "7 класс" },
  { value: "8-9", label: "8-9 класс" },
  { value: "10-11", label: "10-11 класс (колледж/1 курс)" },
  { value: "12", label: "12 класс (колледж)" },
];

function safeArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function normalizeUiErrorMessage(error: unknown, fallback = "Ошибка") {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : error == null ? "" : String(error);

  const msg = raw.trim();

  if (!msg) return fallback;

  const lower = msg.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "Ошибка соединения с сервером";
  }

  return msg;
}

function cacheBustUrl(url: string) {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

function extractUploadUrl(json: UploadApiResponse | null, fallbackBucket: string): string {
  if (!json) return "";

  const directUrl = json.publicUrl || json.url || json.imageUrl || json.data?.publicUrl || json.data?.url || json.data?.imageUrl;

  if (directUrl) return String(directUrl);

  const bucket = json.bucket || json.data?.bucket || fallbackBucket;
  const path = json.path || json.data?.path;

  if (bucket && path) {
    return getStoragePublicUrl(String(bucket), String(path));
  }

  return "";
}

async function uploadImageThroughApi(params: {
  file: File;
  bucket: string;
  folder: string;
}) {
  const formData = new FormData();

  formData.append("file", params.file);
  formData.append("bucket", params.bucket);
  formData.append("folder", params.folder);
  formData.append("pathPrefix", params.folder);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const json = await readJsonSafe<UploadApiResponse>(res);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  const uploadedUrl = extractUploadUrl(json, params.bucket);

  if (!uploadedUrl) {
    throw new Error("Сервер загрузил файл, но не вернул publicUrl");
  }

  return cacheBustUrl(uploadedUrl);
}

function getInlineCount(row: CrosswordRow) {
  const raw = row.assignments_count ?? row.assignment_count ?? row.assignmentsCount ?? row._count?.assignments ?? null;
  const n = Number(raw);

  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function buildCountsFromAssignments(assignments: AssignmentLike[]) {
  const map: Record<string, number> = {};

  for (const assignment of assignments) {
    const crosswordId = assignment.crossword_id ?? assignment.crosswordId ?? null;

    if (crosswordId) {
      map[String(crosswordId)] = (map[String(crosswordId)] || 0) + 1;
    }
  }

  return map;
}

async function loadAssignmentCountsFallback() {
  try {
    const res = await fetch("/api/admin/assignments?limit=5000", {
      cache: "no-store",
    });

    const json = await readJsonSafe<any>(res);

    if (!res.ok || json?.ok === false) return {};

    const assignments = Array.isArray(json?.assignments)
      ? json.assignments
      : Array.isArray(json?.data)
        ? json.data
        : [];

    return buildCountsFromAssignments(assignments);
  } catch {
    return {};
  }
}

export default function CrosswordsTab({ onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [crosswords, setCrosswords] = useState<CrosswordRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classLevel, setClassLevel] = useState<string[]>([]);
  const [orderIndex, setOrderIndex] = useState<number>(0);
  const [isAvailable, setIsAvailable] = useState(false);

  const [coverUrl, setCoverUrl] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/admin/crosswords", { cache: "no-store" });
      const json = await readJsonSafe<any>(res);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Не удалось загрузить кроссворды");
      }

      const list: CrosswordRow[] = Array.isArray(json?.crosswords) ? json.crosswords : [];

      setCrosswords(list);

      const inlineCounts: Record<string, number> = {};

      for (const cw of list) {
        const count = getInlineCount(cw);
        if (count !== null) inlineCounts[cw.id] = count;
      }

      if (Object.keys(inlineCounts).length > 0) {
        setCounts(inlineCounts);
      } else {
        setCounts(await loadAssignmentCountsFallback());
      }
    } catch (e: any) {
      setErr(normalizeUiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setClassLevel([]);
    setOrderIndex(0);
    setIsAvailable(false);
    setCoverUrl("");
    setCoverPreview("");
    setFormOpen(true);
  }

  function openEdit(cw: CrosswordRow) {
    setEditingId(cw.id);
    setTitle(cw.title ?? "");
    setDescription(cw.description ?? "");
    setClassLevel(safeArr(cw.class_level));
    setOrderIndex(Number(cw.order_index ?? 0));
    setIsAvailable(Boolean(cw.is_available));
    setCoverUrl(cw.cover_image_url ?? "");
    setCoverPreview(cw.cover_image_url ?? "");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving || uploadingCover) return;
    setFormOpen(false);
  }

  async function uploadCover(file: File) {
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

    if (!allowed.includes(ext)) {
      throw new Error("Поддерживаются JPG/PNG/GIF/WebP/AVIF");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Файл больше 5MB");
    }

    return uploadImageThroughApi({
      file,
      bucket: "covers",
      folder: "crosswords",
    });
  }

  async function onPickCover(file: File) {
    const local = URL.createObjectURL(file);
    setCoverPreview(local);
    setUploadingCover(true);

    try {
      const url = await uploadCover(file);
      setCoverUrl(url);
      setCoverPreview(url);
    } catch (e: any) {
      setCoverUrl("");
      setCoverPreview("");
      alert("❌ Ошибка загрузки обложки: " + normalizeUiErrorMessage(e));
    } finally {
      setUploadingCover(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function toggleClass(value: string) {
    setClassLevel((prev) => (prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]));
  }

  async function save() {
    const normalizedTitle = title.trim();
    const normalizedClassLevels = classLevel;

    if (!normalizedTitle) {
      alert("❌ Введите название кроссворда");
      return;
    }

    if (!normalizedClassLevels.length) {
      alert("❌ Выберите хотя бы один класс");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        title: normalizedTitle,
        description: description.trim() || null,
        class_level: normalizedClassLevels,
        order_index: Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : 0,
        is_available: isAvailable,
        cover_image_url: coverUrl || null,
      };

      const res = editingId
        ? await fetch(`/api/admin/crosswords/${encodeURIComponent(editingId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/crosswords", {
            method: "POST",
            headers: { "content-type": "application/json" },
            cache: "no-store",
            body: JSON.stringify(payload),
          });

      const json = await readJsonSafe<any>(res);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Не удалось сохранить");
      }

      setFormOpen(false);
      await load();
      await onChanged?.();
    } catch (e: any) {
      alert("❌ Ошибка сохранения: " + normalizeUiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function del(cw: CrosswordRow) {
    const okConfirm = window.confirm(`Удалить кроссворд "${cw.title}"?`);
    if (!okConfirm) return;

    try {
      const res = await fetch(`/api/admin/crosswords/${encodeURIComponent(cw.id)}`, {
        method: "DELETE",
        cache: "no-store",
      });

      const json = await readJsonSafe<any>(res);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      await load();
      await onChanged?.();
    } catch (e: any) {
      alert("❌ Ошибка удаления: " + normalizeUiErrorMessage(e));
    }
  }

  if (loading) return <LoadingBlock text="Загружаем кроссворды..." />;
  if (err) return <ErrorBox message={err} retryMode="reload" />;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🧩 Кроссворды</h3>

        <button className="btn" onClick={openCreate} type="button">
          ➕ Создать кроссворд
        </button>
      </div>

      {formOpen ? (
        <div className="card" style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>{editingId ? "✏️ Редактировать кроссворд" : "➕ Новый кроссворд"}</h4>

          <div className="row" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <label className="small-muted">Название</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="col" style={{ width: 160 }}>
              <label className="small-muted">Порядок, больше = выше</label>
              <input
                className="input"
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="col" style={{ marginTop: 10 }}>
            <label className="small-muted">Описание</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="col" style={{ marginTop: 10 }}>
            <label className="small-muted">Классы, множественный выбор</label>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CLASS_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={classLevel.includes(c.value) ? "btn small" : "btn ghost small"}
                  onClick={() => toggleClass(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="small-muted" style={{ marginTop: 6 }}>
              Выбрано: {classLevel.length ? classLevel.join(", ") : "ничего"}
            </div>
          </div>

          <div className="col" style={{ marginTop: 10 }}>
            <label className="small-muted">Обложка, bucket: covers</label>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPickCover(file);
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={uploadingCover}>
                {uploadingCover ? "Загружаем..." : "📁 Загрузить обложку"}
              </button>

              {coverUrl ? (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setCoverUrl("");
                    setCoverPreview("");
                  }}
                  disabled={uploadingCover}
                >
                  🗑️ Удалить
                </button>
              ) : null}
            </div>

            {coverPreview ? (
              <img
                src={coverPreview}
                alt="cover"
                style={{
                  marginTop: 10,
                  maxWidth: 240,
                  maxHeight: 160,
                  borderRadius: 10,
                  display: "block",
                }}
              />
            ) : null}
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
              <span>Доступен для всех пользователей</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button className="btn" onClick={() => void save()} disabled={saving || uploadingCover} type="button">
              {saving ? "Сохраняем..." : "💾 Сохранить"}
            </button>

            <button className="btn secondary" onClick={closeForm} type="button" disabled={saving || uploadingCover}>
              ❌ Отмена
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>№</th>
              <th>Название</th>
              <th>Описание</th>
              <th>Классы</th>
              <th>Заданий</th>
              <th>Доступ</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>

          <tbody>
            {crosswords.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, textAlign: "center" }}>
                  Кроссвордов нет
                </td>
              </tr>
            ) : (
              crosswords.map((cw, idx) => {
                const number = crosswords.length - idx;

                return (
                  <tr key={cw.id}>
                    <td>
                      <strong>{number}</strong>
                    </td>

                    <td>
                      <strong>{cw.title}</strong>

                      {cw.cover_image_url ? (
                        <div className="small-muted" style={{ marginTop: 6 }}>
                          🖼️ есть обложка
                        </div>
                      ) : null}
                    </td>

                    <td>{cw.description || "—"}</td>
                    <td>{safeArr(cw.class_level).length ? safeArr(cw.class_level).join(", ") : "—"}</td>
                    <td>{counts[cw.id] ?? 0}</td>
                    <td>{cw.is_available ? "🌍 Для всех" : "🔒 По доступу"}</td>
                    <td>{cw.is_active ? "✅ Активен" : "❌ Неактивен"}</td>

                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn small" onClick={() => openEdit(cw)} type="button">
                        ✏️
                      </button>{" "}

                      <button className="btn small secondary" onClick={() => void del(cw)} type="button">
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="small-muted" style={{ marginTop: 8 }}>
          💡 Сортировка: сверху кроссворды с большим “Порядком”. Нумерация слева показывает позицию.
        </div>
      </div>
    </div>
  );
}