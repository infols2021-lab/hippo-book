"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  GATEHOUSE_LEVELS,
  formatGatehouseLevels,
  normalizeGatehouseLevels,
  type GatehouseLevelCode,
} from "@/lib/exams/levels";
import type { GatehouseMaterialRow } from "./GatehouseMockTestsTab";

type Props = {
  material: GatehouseMaterialRow | null;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
};

type Notice = {
  type: "success" | "error";
  text: string;
};

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function getInitialLevels(material: GatehouseMaterialRow | null): GatehouseLevelCode[] {
  return normalizeGatehouseLevels(material?.target_levels ?? []);
}

export default function GatehouseMaterialEditor({ material, onCancel, onSaved }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const [targetLevels, setTargetLevels] = useState<GatehouseLevelCode[]>(() => getInitialLevels(material));
  const [orderIndex, setOrderIndex] = useState(Number(material?.order_index ?? 0));
  const [isAvailable, setIsAvailable] = useState(Boolean(material?.is_available));
  const [coverUrl, setCoverUrl] = useState(material?.cover_image_url ?? "");
  const [coverPreview, setCoverPreview] = useState(material?.cover_image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const isEdit = Boolean(material?.id);

  function showError(text: string) {
    setNotice({ type: "error", text });
  }

  function toggleLevel(level: GatehouseLevelCode) {
    setTargetLevels((current) => {
      if (current.includes(level)) {
        return current.filter((item) => item !== level);
      }

      return normalizeGatehouseLevels([...current, level]);
    });
  }

  async function uploadCover(file: File) {
    const bucket = "covers";
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

    if (!allowed.includes(ext)) {
      throw new Error("Поддерживаются JPG/PNG/GIF/WebP/AVIF");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Файл больше 5MB");
    }

    const path = `gatehouse/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    setUploadingCover(true);
    setNotice(null);

    try {
      const url = await uploadCover(file);
      setCoverUrl(url);
      setCoverPreview(url);
    } catch (error: any) {
      setCoverUrl("");
      setCoverPreview("");
      showError("Ошибка загрузки обложки: " + (error?.message || String(error)));
    } finally {
      setUploadingCover(false);
    }
  }

  function clearCover() {
    setCoverUrl("");
    setCoverPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (!normalizedTitle) {
      showError("Введите название пробного теста.");
      return;
    }

    if (targetLevels.length === 0) {
      showError("Выберите хотя бы один уровень Gatehouse Awards.");
      return;
    }

    setSaving(true);
    setNotice(null);

    const payload = {
      branch_type: "gatehouse",
      material_kind: "mock_test",
      title: normalizedTitle,
      description: normalizedDescription || null,
      cover_image_url: coverUrl || null,
      is_available: isAvailable,
      is_active: true,
      order_index: Number.isFinite(Number(orderIndex)) ? Number(orderIndex) : 0,
      class_levels: [],
      target_levels: targetLevels,
      meta: {},
    };

    try {
      const url = isEdit ? `/api/admin/materials/${material?.id}` : "/api/admin/materials";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Не удалось сохранить материал");
      }

      setNotice({
        type: "success",
        text: isEdit ? "Пробный тест обновлён." : "Пробный тест создан.",
      });

      await onSaved();
    } catch (error: any) {
      showError(error?.message || "Не удалось сохранить материал.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-form-card">
      <div className="admin-section-head">
        <div>
          <h3>{isEdit ? "✏️ Изменить пробный тест" : "➕ Новый пробный тест"}</h3>
          <p>
            Материал относится только к Gatehouse Awards. Олимпиадные учебники и кроссворды не
            меняются.
          </p>
        </div>

        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          ✕ Закрыть
        </button>
      </div>

      {notice ? (
        <div className={notice.type === "success" ? "success-box" : "error"}>
          {notice.type === "success" ? "✅ " : "❌ "}
          {notice.text}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Название</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Gatehouse A1 Mock Test"
              disabled={saving}
            />
          </label>

          <label className="form-field">
            <span>Порядок</span>
            <input
              type="number"
              value={orderIndex}
              onChange={(event) => setOrderIndex(Number(event.target.value))}
              disabled={saving}
            />
          </label>
        </div>

        <label className="form-field">
          <span>Описание</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Краткое описание пробного теста"
            rows={4}
            disabled={saving}
          />
        </label>

        <div className="form-field">
          <span>Уровни Gatehouse Awards</span>

          <div className="chips-grid">
            {GATEHOUSE_LEVELS.map((level) => {
              const active = targetLevels.includes(level.code);

              return (
                <button
                  key={level.code}
                  type="button"
                  className={active ? "chip active" : "chip"}
                  onClick={() => toggleLevel(level.code)}
                  disabled={saving}
                  title={level.description}
                >
                  {level.label}
                </button>
              );
            })}
          </div>

          <small>Выбрано: {formatGatehouseLevels(targetLevels)}</small>
        </div>

        <label className="form-check">
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
            disabled={saving}
          />
          <span>Доступен всем без заявки</span>
        </label>

        <div className="form-field">
          <span>Обложка</span>

          <div className="cover-editor">
            <div className="cover-preview">
              {coverPreview ? (
                <img src={coverPreview} alt="" />
              ) : (
                <div className="cover-placeholder">
                  <span>🎓</span>
                  <p>Обложка не выбрана</p>
                </div>
              )}
            </div>

            <div className="cover-actions">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onPickCover(file);
                }}
                disabled={saving || uploadingCover}
              />

              <div className="form-grid">
                <label className="form-field">
                  <span>URL обложки</span>
                  <input
                    value={coverUrl}
                    onChange={(event) => {
                      setCoverUrl(event.target.value);
                      setCoverPreview(event.target.value);
                    }}
                    placeholder="https://..."
                    disabled={saving || uploadingCover}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={saving || uploadingCover}
                >
                  {uploadingCover ? "Загружаем..." : "📷 Загрузить"}
                </button>

                <button
                  type="button"
                  className="btn"
                  onClick={clearCover}
                  disabled={saving || uploadingCover}
                >
                  🧹 Очистить
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-form-actions">
          <button type="submit" className="btn primary" disabled={saving || uploadingCover}>
            {saving ? "Сохраняем..." : isEdit ? "💾 Сохранить" : "➕ Создать"}
          </button>

          <button type="button" className="btn" onClick={onCancel} disabled={saving}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}