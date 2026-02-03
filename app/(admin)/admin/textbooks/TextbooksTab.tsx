"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

type Props = { onChanged?: () => void | Promise<void> };

type TextbookRow = {
  id: string;
  title: string;
  description: string | null;
  class_level: string[] | null;
  cover_image_url: string | null;
  order_index: number | null;
  is_available: boolean | null;
  is_active: boolean | null;
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

function safeArr(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(String).filter(Boolean);
}

export default function TextbooksTab({ onChanged }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [textbooks, setTextbooks] = useState<TextbookRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classLevel, setClassLevel] = useState<string[]>([]);
  const [orderIndex, setOrderIndex] = useState<number>(0);
  const [isAvailable, setIsAvailable] = useState(false);

  // cover
  const [coverUrl, setCoverUrl] = useState<string>("");
  const [coverPreview, setCoverPreview] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch("/api/admin/textbooks", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Не удалось загрузить учебники");

      const list: TextbookRow[] = Array.isArray(json?.textbooks) ? json.textbooks : [];
      setTextbooks(list);

      // counts
      const { data: ass, error: aErr } = await supabase.from("assignments").select("id,textbook_id");
      if (!aErr) {
        const m: Record<string, number> = {};
        (ass ?? []).forEach((a: any) => {
          const tid = a?.textbook_id;
          if (tid) m[String(tid)] = (m[String(tid)] || 0) + 1;
        });
        setCounts(m);
      } else {
        setCounts({});
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка");
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

  function openEdit(tb: TextbookRow) {
    setEditingId(tb.id);
    setTitle(tb.title ?? "");
    setDescription(tb.description ?? "");
    setClassLevel(safeArr(tb.class_level));
    setOrderIndex(Number(tb.order_index ?? 0));
    setIsAvailable(Boolean(tb.is_available));
    setCoverUrl(tb.cover_image_url ?? "");
    setCoverPreview(tb.cover_image_url ?? "");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function uploadCover(file: File) {
    const bucket = "covers";
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];
    if (!allowed.includes(ext)) throw new Error("Поддерживаются JPG/PNG/GIF/WebP/AVIF");
    if (file.size > 5 * 1024 * 1024) throw new Error("Файл больше 5MB");

    const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function onPickCover(file: File) {
    const local = URL.createObjectURL(file);
    setCoverPreview(local);

    try {
      const url = await uploadCover(file);
      setCoverUrl(url);
      setCoverPreview(url);
    } catch (e: any) {
      setCoverUrl("");
      setCoverPreview("");
      alert("❌ Ошибка загрузки обложки: " + (e?.message || String(e)));
    }
  }

  function toggleClass(v: string) {
    setClassLevel((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  async function save() {
    const t = title.trim();
    const cls = classLevel;

    if (!t) return alert("❌ Введите название учебника");
    if (!cls.length) return alert("❌ Выберите хотя бы один класс");

    setSaving(true);
    try {
      const payload = {
        title: t,
        description: description.trim(),
        class_level: cls,
        order_index: orderIndex,
        is_available: isAvailable,
        cover_image_url: coverUrl || null,
      };

      const res = editingId
        ? await fetch(`/api/admin/textbooks/${encodeURIComponent(editingId)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/textbooks", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });

      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Не удалось сохранить");

      setFormOpen(false);
      await load();
      await onChanged?.();
    } catch (e: any) {
      alert("❌ Ошибка сохранения: " + (e?.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function del(tb: TextbookRow) {
    const okConfirm = confirm(`Удалить учебник "${tb.title}"?`);
    if (!okConfirm) return;

    try {
      const res = await fetch(`/api/admin/textbooks/${encodeURIComponent(tb.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.error || "Не удалось удалить");
      await load();
      await onChanged?.();
    } catch (e: any) {
      alert("❌ Ошибка удаления: " + (e?.message || String(e)));
    }
  }

  if (loading) return <LoadingBlock text="Загружаем учебники..." />;
  if (err) return <ErrorBox message={err} retryMode="reload" />;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>📚 Учебники</h3>
        <button className="btn" onClick={openCreate} type="button">
          ➕ Создать учебник
        </button>
      </div>

      {formOpen ? (
        <div className="card" style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>{editingId ? "✏️ Редактировать учебник" : "➕ Новый учебник"}</h4>

          <div className="row" style={{ gap: 12 }}>
            <div className="col" style={{ flex: 1 }}>
              <label className="small-muted">Название</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="col" style={{ width: 160 }}>
              <label className="small-muted">Порядок (больше = выше)</label>
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
            <label className="small-muted">Классы (множественный выбор)</label>

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
            <label className="small-muted">Обложка (bucket: covers)</label>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickCover(f);
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
                📁 Загрузить обложку
              </button>

              {coverUrl ? (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setCoverUrl("");
                    setCoverPreview("");
                  }}
                >
                  🗑️ Удалить
                </button>
              ) : null}
            </div>

            {coverPreview ? (
              <img
                src={coverPreview}
                alt="cover"
                style={{ marginTop: 10, maxWidth: 240, maxHeight: 160, borderRadius: 10, display: "block" }}
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
            <button className="btn" onClick={() => void save()} disabled={saving} type="button">
              {saving ? "Сохраняем..." : "💾 Сохранить"}
            </button>
            <button className="btn secondary" onClick={closeForm} type="button">
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
            {textbooks.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 14, textAlign: "center" }}>
                  Учебников нет
                </td>
              </tr>
            ) : (
              textbooks.map((tb, idx) => {
                // ✅ “Новые сверху”: первый = N, последний = 1
                const number = textbooks.length - idx;

                return (
                  <tr key={tb.id}>
                    <td>
                      <strong>{number}</strong>
                    </td>
                    <td>
                      <strong>{tb.title}</strong>
                      {tb.cover_image_url ? (
                        <div className="small-muted" style={{ marginTop: 6 }}>
                          🖼️ есть обложка
                        </div>
                      ) : null}
                    </td>
                    <td>{tb.description || "—"}</td>
                    <td>{safeArr(tb.class_level).length ? safeArr(tb.class_level).join(", ") : "—"}</td>
                    <td>{counts[tb.id] ?? 0}</td>
                    <td>{tb.is_available ? "🌍 Для всех" : "🔒 По доступу"}</td>
                    <td>{tb.is_active ? "✅ Активен" : "❌ Неактивен"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn small" onClick={() => openEdit(tb)} type="button">
                        ✏️
                      </button>{" "}
                      <button className="btn small secondary" onClick={() => void del(tb)} type="button">
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
          💡 Сортировка: сверху идут учебники с большим “Порядком”. Нумерация слева показывает позицию (N сверху → 1 снизу).
        </div>
      </div>
    </div>
  );
}
