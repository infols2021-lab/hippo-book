"use client";

import { useCallback, useEffect, useState } from "react";

type AssignmentOption = {
  id: string;
  title: string;
  order_index?: number | null;
};

type Props = {
  materialId: string;
  value: string | null;
  onChange: (assignmentId: string | null) => void;
  label?: string;
};

export default function RoadmapAssignmentSelect({
  materialId,
  value,
  onChange,
  label = "Задание",
}: Props) {
  const [options, setOptions] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/assignments?material_id=${encodeURIComponent(materialId)}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;
      const rows = (payload?.assignments ?? []) as AssignmentOption[];
      setOptions(
        [...rows].sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0)),
      );
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <label className="roadmap-visual-field">
      <span className="roadmap-visual-field-head">
        <span>{label}</span>
        <button type="button" className="roadmap-visual-link-btn" onClick={() => void load()} disabled={loading}>
          {loading ? "Загрузка..." : "Обновить список"}
        </button>
      </span>
      <select
        className="roadmap-visual-select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        disabled={loading}
      >
        <option value="">— Не привязано —</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      {options.length === 0 && !loading ? (
        <span className="roadmap-visual-field-hint">
          Создайте задания в админке → Задания, выберите этот материал, затем нажмите «Обновить список».
        </span>
      ) : null}
    </label>
  );
}
