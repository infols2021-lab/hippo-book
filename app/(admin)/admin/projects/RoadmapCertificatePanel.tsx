"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CERTIFICATE_FIELD_OPTIONS,
  certificateTemplatePath,
} from "@/lib/roadmap/certificateConfig";
import type { RoadmapCertificateTemplateConfig } from "@/lib/roadmap/types";

type Props = {
  materialId: string;
  materialTitle: string;
};

type PdfField = {
  name: string;
  type: string;
};

const CERTIFICATE_BUCKET = "hippo-book-certificates";

export default function RoadmapCertificatePanel({ materialId, materialTitle }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<RoadmapCertificateTemplateConfig | null>(null);
  const [fields, setFields] = useState<PdfField[]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [fallbacks, setFallbacks] = useState<Record<string, string>>({});

  const templatePath = useMemo(() => certificateTemplatePath(materialId), [materialId]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/roadmap/${materialId}/certificate`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;

      if (!res.ok || json?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const nextTemplate = (payload?.template ?? null) as RoadmapCertificateTemplateConfig | null;
      setTemplate(nextTemplate);
      setFields(Array.isArray(payload?.fields) ? payload.fields : []);
      setFieldMap(nextTemplate?.field_map ?? {});
      setFallbacks(nextTemplate?.fallbacks ?? {});
    } catch (err: any) {
      setError(String(err?.message || err || "Не удалось загрузить настройки сертификата"));
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function uploadTemplate(file: File) {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("bucket", CERTIFICATE_BUCKET);
      formData.append("path", templatePath);
      formData.append("upsert", "1");
      formData.append("file", file);

      const uploadRes = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json().catch(() => null);
      const uploadPayload = uploadJson?.data ?? uploadJson;

      if (!uploadRes.ok || uploadJson?.ok === false) {
        throw new Error(uploadPayload?.error || `Upload HTTP ${uploadRes.status}`);
      }

      const parseRes = await fetch(`/api/admin/roadmap/${materialId}/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: CERTIFICATE_BUCKET,
          path: templatePath,
        }),
      });
      const parseJson = await parseRes.json().catch(() => null);
      const parsePayload = parseJson?.data ?? parseJson;

      if (!parseRes.ok || parseJson?.ok === false) {
        throw new Error(parsePayload?.error || `Parse HTTP ${parseRes.status}`);
      }

      const detectedFields = Array.isArray(parsePayload?.fields) ? parsePayload.fields : [];
      const suggestedMap = (parsePayload?.suggested_field_map ?? {}) as Record<string, string>;

      setFields(detectedFields);
      setFieldMap((prev) => ({ ...suggestedMap, ...prev }));
      setTemplate({
        bucket: CERTIFICATE_BUCKET,
        path: templatePath,
        field_map: { ...suggestedMap, ...fieldMap },
        fallbacks,
        updated_at: new Date().toISOString(),
      });

      setMessage(
        detectedFields.length
          ? `Шаблон загружен. Найдено полей формы: ${detectedFields.length}. Настройте маппинг и сохраните.`
          : "Шаблон загружен, но поля формы не найдены. Проверьте PDF (см. инструкцию).",
      );
    } catch (err: any) {
      setError(String(err?.message || err || "Ошибка загрузки шаблона"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/roadmap/${materialId}/certificate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: CERTIFICATE_BUCKET,
          path: templatePath,
          field_map: fieldMap,
          fallbacks,
        }),
      });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;

      if (!res.ok || json?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setTemplate(payload?.template ?? null);
      setFields(Array.isArray(payload?.fields) ? payload.fields : fields);
      setFieldMap(payload?.template?.field_map ?? fieldMap);
      setMessage(`Настройки сертификата сохранены для «${materialTitle}».`);
    } catch (err: any) {
      setError(String(err?.message || err || "Ошибка сохранения"));
    } finally {
      setBusy(false);
    }
  }

  function handleTestDownload() {
    window.open(`/api/admin/roadmap/${materialId}/certificate?test=1`, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return <div className="roadmap-editor-loading">Загрузка настроек сертификата...</div>;
  }

  return (
    <div className="roadmap-certificate-panel">
      <div className="roadmap-import-head">
        <div>
          <h4 className="roadmap-import-title">Сертификат PDF</h4>
          <p className="roadmap-import-subtitle">
            Загрузите PDF-шаблон с полями формы в бакет {CERTIFICATE_BUCKET}. Путь: {templatePath}
          </p>
        </div>
        <a
          href="/docs/certificate-template-guide.md"
          target="_blank"
          rel="noreferrer"
          className="roadmap-import-template-link"
        >
          Как сделать PDF
        </a>
      </div>

      <div
        className={`roadmap-certificate-dropzone ${busy ? "is-busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void uploadTemplate(file);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadTemplate(file);
            e.currentTarget.value = "";
          }}
        />
        <div className="roadmap-certificate-dropzone-title">Перетащите PDF-шаблон сюда</div>
        <div className="roadmap-certificate-dropzone-subtitle">или нажмите для выбора файла</div>
        {template?.updated_at ? (
          <div className="roadmap-certificate-dropzone-meta">
            Текущий шаблон загружен: {new Date(template.updated_at).toLocaleString("ru-RU")}
          </div>
        ) : null}
      </div>

      {fields.length > 0 ? (
        <div className="roadmap-certificate-fields">
          <div className="roadmap-certificate-fields-head">Поля PDF → данные ученика</div>
          {fields.map((field) => (
            <div key={field.name} className="roadmap-certificate-field-row">
              <div className="roadmap-certificate-field-name">
                <strong>{field.name}</strong>
                <span>{field.type}</span>
              </div>
              <select
                className="roadmap-visual-select"
                value={fieldMap[field.name] || "empty"}
                onChange={(e) =>
                  setFieldMap((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
              >
                {CERTIFICATE_FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                className="roadmap-certificate-fallback-input"
                value={fallbacks[field.name] || ""}
                placeholder="Fallback (если пусто)"
                onChange={(e) =>
                  setFallbacks((prev) => ({
                    ...prev,
                    [field.name]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="roadmap-visual-empty">
          Поля формы пока не найдены. Загрузите PDF с text fields (см. инструкцию).
        </div>
      )}

      <div className="roadmap-import-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "Сохранение..." : "Сохранить сертификат"}
        </button>
        <button type="button" className="btn secondary" disabled={busy} onClick={handleTestDownload}>
          Тестовый PDF
        </button>
      </div>

      {message ? <div className="roadmap-import-message is-success">{message}</div> : null}
      {error ? <div className="roadmap-import-message is-error">{error}</div> : null}
    </div>
  );
}
