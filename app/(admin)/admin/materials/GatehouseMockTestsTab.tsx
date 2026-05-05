"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import { formatGatehouseLevels } from "@/lib/exams/levels";
import GatehouseMaterialEditor from "./GatehouseMaterialEditor";

type Props = {
  onChanged?: () => void | Promise<void>;
};

export type GatehouseMaterialRow = {
  id: string;
  branch_type: "gatehouse";
  material_kind: "mock_test";
  title: string;
  description: string | null;
  cover_image_url: string | null;
  order_index: number | null;
  is_available: boolean | null;
  is_active: boolean | null;
  target_levels: string[] | null;
  class_levels: string[] | null;
  assignments_count?: number | null;
};

async function safeJson(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeMaterials(value: unknown): GatehouseMaterialRow[] {
  if (!Array.isArray(value)) return [];

  return value.map((item: any) => ({
    id: String(item?.id ?? ""),
    branch_type: "gatehouse",
    material_kind: "mock_test",
    title: String(item?.title ?? ""),
    description: typeof item?.description === "string" ? item.description : null,
    cover_image_url: typeof item?.cover_image_url === "string" ? item.cover_image_url : null,
    order_index: Number.isFinite(Number(item?.order_index)) ? Number(item.order_index) : 0,
    is_available: Boolean(item?.is_available),
    is_active: item?.is_active === false ? false : true,
    target_levels: Array.isArray(item?.target_levels) ? item.target_levels.map(String) : [],
    class_levels: Array.isArray(item?.class_levels) ? item.class_levels.map(String) : [],
    assignments_count: Number.isFinite(Number(item?.assignments_count))
      ? Number(item.assignments_count)
      : 0,
  }));
}

export default function GatehouseMockTestsTab({ onChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [materials, setMaterials] = useState<GatehouseMaterialRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GatehouseMaterialRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeMaterials = useMemo(
    () => materials.filter((material) => material.is_active !== false),
    [materials],
  );

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(
        "/api/admin/materials?branch_type=gatehouse&material_kind=mock_test&include_counts=true",
        { cache: "no-store" },
      );
      const json = await safeJson(res);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Не удалось загрузить пробные тесты");
      }

      setMaterials(normalizeMaterials(json?.materials));
    } catch (error: any) {
      setErr(error?.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(material: GatehouseMaterialRow) {
    setEditing(material);
    setFormOpen(true);
  }

  function closeEditor() {
    setFormOpen(false);
    setEditing(null);
  }

  async function afterSaved() {
    closeEditor();
    await load();
    await onChanged?.();
  }

  async function deleteMaterial(material: GatehouseMaterialRow) {
    if (deletingId) return;

    const count = Number(material.assignments_count ?? 0);
    const warning =
      count > 0
        ? `У материала "${material.title}" есть задания: ${count}. При удалении материала они тоже могут удалиться, если включён каскад в БД. Удалить?`
        : `Удалить материал "${material.title}"?`;

    if (!window.confirm(warning)) return;

    setDeletingId(material.id);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/materials/${material.id}`, {
        method: "DELETE",
      });
      const json = await safeJson(res);

      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || "Не удалось удалить материал");
      }

      await load();
      await onChanged?.();
    } catch (error: any) {
      setErr(error?.message || "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <LoadingBlock text="Загружаем пробные тесты Gatehouse Awards..." />;
  if (err) return <ErrorBox message={err} retry={load} />;

  return (
    <div>
      <div className="admin-section-head">
        <div>
          <h2>🎓 Пробные тесты Gatehouse Awards</h2>
          <p>
            Это материалы экзаменов. Внутри каждого материала админ сможет создавать задания через
            общий движок заданий.
          </p>
        </div>

        <button type="button" className="btn primary" onClick={openCreate}>
          ➕ Создать пробный тест
        </button>
      </div>

      {formOpen ? (
        <GatehouseMaterialEditor
          material={editing}
          onCancel={closeEditor}
          onSaved={afterSaved}
        />
      ) : null}

      {activeMaterials.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎓</div>
          <h3>Пробных тестов пока нет</h3>
          <p>Создайте первый материал Gatehouse Awards, чтобы потом добавить в него задания.</p>
          <button type="button" className="btn primary" onClick={openCreate}>
            ➕ Создать пробный тест
          </button>
        </div>
      ) : (
        <div className="admin-grid">
          {activeMaterials.map((material) => (
            <article className="admin-card" key={material.id}>
              <div className="admin-card-cover">
                {material.cover_image_url ? (
                  <img src={material.cover_image_url} alt="" />
                ) : (
                  <div className="admin-card-cover-placeholder">
                    <span>📝</span>
                  </div>
                )}

                <div className="admin-card-badge">
                  {material.is_available ? "Доступен всем" : "По заявке"}
                </div>
              </div>

              <div className="admin-card-body">
                <div className="admin-card-meta">
                  <span>Gatehouse Awards</span>
                  <span>{formatGatehouseLevels(material.target_levels ?? [])}</span>
                </div>

                <h3>{material.title}</h3>

                {material.description ? <p>{material.description}</p> : <p>Описание не указано.</p>}

                <div className="admin-card-stats">
                  <span>📝 Заданий: {material.assignments_count ?? 0}</span>
                  <span>↕️ Порядок: {material.order_index ?? 0}</span>
                </div>

                <div className="admin-card-actions">
                  <button type="button" className="btn" onClick={() => openEdit(material)}>
                    ✏️ Изменить
                  </button>

                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => deleteMaterial(material)}
                    disabled={deletingId === material.id}
                  >
                    {deletingId === material.id ? "Удаляем..." : "🗑️ Удалить"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}