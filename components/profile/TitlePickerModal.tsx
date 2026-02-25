"use client";

import { useMemo } from "react";
import Modal from "@/components/Modal";
import * as Roadmap from "@/lib/streaks/roadmap";

export type TitlePickerChoice = {
  code: string;
  label: string;
  day: number;
  description?: string;
};

export type TitleCatalogItem = {
  code: string;
  label: string;
  unlockAt?: number;
  unlock_at?: number;
  day?: number;
  description?: string | null;
  sortOrder?: number;
  sort_order?: number;
  isActive?: boolean;
  is_active?: boolean;
  version?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;

  longestStreak?: number;
  currentTitleCode?: string | null;
  currentTitleLabel?: string | null;

  onSelectTitle?: (choice: TitlePickerChoice) => void;
  onClearLocalTitle?: () => void;

  loading?: boolean;

  /** Новый проп: каталог титулов из API/БД (streak_title_catalog) */
  titleCatalog?: TitleCatalogItem[] | null;
};

type NormalizedTitleMilestone = {
  code: string;
  label: string;
  day: number;
  description?: string;
  sortOrder?: number;
};

const FALLBACK_TITLE_MILESTONES: NormalizedTitleMilestone[] = [
  { code: "streak_3_just_joined", label: "Я только зашёл", day: 3, description: "Первый титул за серию" },
  { code: "streak_7_focused", label: "Целеустремлённый", day: 7, description: "7 дней подряд" },
  { code: "streak_14_knowledge", label: "Идущий к знаниям", day: 14, description: "14 дней подряд" },
  { code: "streak_21_discipline", label: "Железная дисциплина", day: 21, description: "3 недели подряд" },
  { code: "streak_30_habit_master", label: "Мастер привычки", day: 30, description: "30 дней подряд" },
  { code: "streak_60_unstoppable", label: "Неостановимый", day: 60, description: "60 дней подряд" },
  { code: "streak_100_progress_legend", label: "Легенда прогресса", day: 100, description: "100 дней подряд" },
  { code: "streak_300_hipposha_legend", label: "Легенда Хиппоши", day: 300, description: "Особый рубеж" },
];

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function titleCaseFromCode(code: string) {
  return String(code || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function tryNormalizeTitleMilestone(row: any, idx: number): NormalizedTitleMilestone | null {
  if (!row || typeof row !== "object") return null;

  // поддержка DB каталога + старых форматов
  const day = num(
    row.day ??
      row.unlockAt ??
      row.unlock_at ??
      row.days ??
      row.streak ??
      row.minDays ??
      row.requiredDays,
    0
  );
  if (day <= 0) return null;

  const isActive =
    row.is_active === undefined && row.isActive === undefined
      ? true
      : Boolean(row.is_active ?? row.isActive);
  if (!isActive) return null;

  const code = String(
    row.code ?? row.title_code ?? row.titleCode ?? row.id ?? `title_${idx + 1}`
  ).trim();
  if (!code) return null;

  const labelRaw =
    row.label ??
    row.title ??
    row.titleLabel ??
    row.name ??
    row.display_name ??
    row.displayName ??
    titleCaseFromCode(code);

  const label = String(labelRaw || code).trim();
  if (!label) return null;

  const description =
    String(row.description ?? row.desc ?? row.subtitle ?? row.note ?? "").trim() || undefined;

  const sortOrder = num(row.sort_order ?? row.sortOrder, 0);

  return { code, label, day, description, sortOrder };
}

function dedupeTitles(rows: NormalizedTitleMilestone[]): NormalizedTitleMilestone[] {
  const out: NormalizedTitleMilestone[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = row.code.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

function pickTitleRoadmap(externalCatalog?: TitleCatalogItem[] | null): NormalizedTitleMilestone[] {
  // 1) Приоритет — БД каталог, если передали
  const extRows = Array.isArray(externalCatalog)
    ? externalCatalog.map(tryNormalizeTitleMilestone).filter(Boolean)
    : [];

  if (extRows.length) {
    return dedupeTitles(extRows as NormalizedTitleMilestone[]).sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      return a.label.localeCompare(b.label, "ru");
    });
  }

  // 2) Фолбэк — roadmap exports (старый режим)
  const r: any = Roadmap as any;

  const rawTitles =
    r.STREAK_TITLE_MILESTONES ??
    r.STREAK_TITLE_REWARDS ??
    r.TITLE_ROADMAP ??
    r.titleRoadmap ??
    r.STREAK_TITLES ??
    null;

  const titleRows = Array.isArray(rawTitles)
    ? rawTitles.map(tryNormalizeTitleMilestone).filter(Boolean)
    : [];

  const titles = (titleRows.length ? titleRows : FALLBACK_TITLE_MILESTONES) as NormalizedTitleMilestone[];

  return dedupeTitles(titles).sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return a.label.localeCompare(b.label, "ru");
  });
}

export default function TitlePickerModal({
  open,
  onClose,
  longestStreak = 0,
  currentTitleCode = null,
  currentTitleLabel = null,
  onSelectTitle,
  onClearLocalTitle,
  loading = false,
  titleCatalog = null,
}: Props) {
  const safeLongest = Math.max(0, num(longestStreak));

  const titles = useMemo(() => pickTitleRoadmap(titleCatalog), [titleCatalog]);
  const unlockedTitles = useMemo(() => titles.filter((t) => t.day <= safeLongest), [titles, safeLongest]);
  const lockedTitles = useMemo(() => titles.filter((t) => t.day > safeLongest), [titles, safeLongest]);

  const selectedKey = (currentTitleCode || "").trim().toLowerCase();
  const selectedLabelKey = (currentTitleLabel || "").trim().toLowerCase();

  const currentTitleResolved = useMemo(() => {
    const byCode = titles.find((t) => t.code.toLowerCase() === selectedKey);
    if (byCode) return byCode;

    const byLabel = titles.find((t) => t.label.trim().toLowerCase() === selectedLabelKey);
    if (byLabel) return byLabel;

    return null;
  }, [titles, selectedKey, selectedLabelKey]);

  const nextLockedTitle = lockedTitles[0] ?? null;

  return (
    <Modal open={open} onClose={onClose} title="🏷️ Выбор титула" maxWidth={860}>
      <div className="title-picker-modal">
        <div className="tpm-hero">
          <div className="tpm-hero-content">
            <div className="tpm-hero-badge">🦛 Коллекция титулов</div>
            <div className="tpm-hero-title">
              Выбирай титул из <b>доступных</b> наград
            </div>
            <div className="tpm-hero-sub">
              Открытие титулов идёт по <b>рекорду серии</b>, поэтому они не сгорают при сбросе текущей серии.
            </div>

            <div className="tpm-hero-stats">
              <div className="tpm-hero-pill">
                <span>🏆</span>
                <b>{loading ? "…" : `${safeLongest} дн.`}</b>
                <small>рекорд</small>
              </div>
              <div className="tpm-hero-pill">
                <span>✅</span>
                <b>{unlockedTitles.length}</b>
                <small>доступно</small>
              </div>
              <div className="tpm-hero-pill">
                <span>🔒</span>
                <b>{lockedTitles.length}</b>
                <small>закрыто</small>
              </div>
            </div>
          </div>

          <div className="tpm-hippo" aria-hidden="true">
            🦛
          </div>
        </div>

        <section className="tpm-panel">
          <div className="tpm-panel-header">
            <div>
              <div className="tpm-panel-title">Текущий титул</div>
              <div className="tpm-panel-sub">
                {currentTitleResolved
                  ? `Выбран титул за ${currentTitleResolved.day} дн. серии`
                  : currentTitleLabel
                    ? "Выбран пользовательский/серверный титул"
                    : "Титул пока не выбран"}
              </div>
            </div>

            {onClearLocalTitle ? (
              <button type="button" className="tpm-clear-btn" onClick={onClearLocalTitle}>
                Сбросить локальный выбор
              </button>
            ) : null}
          </div>

          <div className="tpm-current-row">
            <div className="tpm-current-pill">
              <span>🏷️</span>
              <b>{currentTitleLabel?.trim() || "Без титула"}</b>
            </div>

            {nextLockedTitle ? (
              <div className="tpm-next-pill">
                <span>🎯</span>
                Следующий титул: <b>{nextLockedTitle.label}</b> на <b>{nextLockedTitle.day}</b> дне
              </div>
            ) : (
              <div className="tpm-next-pill tpm-next-pill--done">
                <span>🚀</span>
                Все титулы в этой дорожке уже открыты
              </div>
            )}
          </div>
        </section>

        <section className="tpm-panel">
          <div className="tpm-panel-title">Доступные титулы</div>
          <div className="tpm-panel-sub">Нажми на кнопку, чтобы выбрать титул для отображения под ФИО.</div>

          {unlockedTitles.length === 0 ? (
            <div className="tpm-empty">
              <div className="tpm-empty-icon">✨</div>
              <div className="tpm-empty-title">Пока нет доступных титулов</div>
              <div className="tpm-empty-sub">Первый титул откроется с ростом серии.</div>
            </div>
          ) : (
            <div className="tpm-list">
              {unlockedTitles.map((t) => {
                const isSelected =
                  (currentTitleCode && t.code === currentTitleCode) ||
                  (!currentTitleCode &&
                    currentTitleLabel?.trim().toLowerCase() === t.label.trim().toLowerCase());

                return (
                  <button
                    key={`${t.code}-${t.day}`}
                    type="button"
                    className={`tpm-title-btn ${isSelected ? "is-selected" : ""}`}
                    onClick={() =>
                      onSelectTitle?.({
                        code: t.code,
                        label: t.label,
                        day: t.day,
                        description: t.description,
                      })
                    }
                    title={`${t.label} • ${t.day} дн.`}
                  >
                    <span className="tpm-title-btn-left">
                      <span className="tpm-title-icon">🏷️</span>
                      <span className="tpm-title-texts">
                        <span className="tpm-title-label">{t.label}</span>
                        <span className="tpm-title-desc">{t.description || "Титул за серию"}</span>
                      </span>
                    </span>

                    <span className="tpm-title-btn-right">
                      <span className="tpm-day-chip">{t.day}д</span>
                      <span className={`tpm-pick-chip ${isSelected ? "is-selected" : ""}`}>
                        {isSelected ? "Выбран" : "Выбрать"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="tpm-panel">
          <div className="tpm-panel-title">Недоступные титулы</div>
          <div className="tpm-panel-sub">Показываем будущие награды — чтобы было видно, к чему идти дальше.</div>

          {lockedTitles.length === 0 ? (
            <div className="tpm-empty tpm-empty--soft">
              <div className="tpm-empty-icon">🎉</div>
              <div className="tpm-empty-title">Недоступных титулов не осталось</div>
              <div className="tpm-empty-sub">Ты уже открыл все титулы из текущей дорожки.</div>
            </div>
          ) : (
            <div className="tpm-list">
              {lockedTitles.map((t) => {
                const left = Math.max(0, t.day - safeLongest);

                return (
                  <button
                    key={`${t.code}-${t.day}`}
                    type="button"
                    className="tpm-title-btn is-locked"
                    disabled
                    title={`${t.label} • откроется на ${t.day} дне`}
                  >
                    <span className="tpm-title-btn-left">
                      <span className="tpm-title-icon">🔒</span>
                      <span className="tpm-title-texts">
                        <span className="tpm-title-label">{t.label}</span>
                        <span className="tpm-title-desc">
                          {t.description || "Титул за серию"} • осталось {left}{" "}
                          {left === 1 ? "день" : left >= 2 && left <= 4 ? "дня" : "дней"}
                        </span>
                      </span>
                    </span>

                    <span className="tpm-title-btn-right">
                      <span className="tpm-day-chip">{t.day}д</span>
                      <span className="tpm-pick-chip is-locked">Закрыто</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .title-picker-modal {
          display: flex;
          flex-direction: column;
          gap: 14px;
          color: #2b3f55;
        }

        .tpm-hero {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 16px;
          border: 1px solid rgba(123, 168, 214, 0.18);
          background:
            radial-gradient(circle at 20% 10%, rgba(255,255,255,0.68), transparent 42%),
            radial-gradient(circle at 85% 20%, rgba(255,255,255,0.45), transparent 36%),
            linear-gradient(135deg, rgba(233, 246, 255, 0.96), rgba(220, 239, 255, 0.93));
          box-shadow:
            0 14px 32px rgba(64, 108, 148, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.8);
        }

        .tpm-hero-content {
          position: relative;
          z-index: 2;
          padding-right: 92px;
        }

        .tpm-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          padding: 7px 11px;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(120, 167, 210, 0.16);
          font-size: 12px;
          font-weight: 900;
          color: #42617f;
        }

        .tpm-hero-title {
          margin-top: 10px;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.2;
          color: #2f465d;
        }

        .tpm-hero-sub {
          margin-top: 6px;
          font-size: 13px;
          line-height: 1.35;
          font-weight: 700;
          color: rgba(47, 70, 93, 0.72);
          max-width: 640px;
        }

        .tpm-hero-stats {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tpm-hero-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(120, 167, 210, 0.16);
          background: rgba(255, 255, 255, 0.76);
          color: #37536d;
          font-weight: 800;
          font-size: 12px;
        }

        .tpm-hero-pill b {
          font-size: 13px;
          color: #2d4257;
        }

        .tpm-hero-pill small {
          font-size: 11px;
          color: rgba(55, 83, 109, 0.72);
          font-weight: 800;
        }

        .tpm-hippo {
          position: absolute;
          right: 12px;
          bottom: 8px;
          font-size: 66px;
          opacity: 0.18;
          transform: rotate(-8deg);
          user-select: none;
          pointer-events: none;
          filter: saturate(0.9);
          z-index: 1;
        }

        .tpm-panel {
          background: linear-gradient(180deg, rgba(255,255,255,0.94), rgba(247,252,255,0.93));
          border-radius: 18px;
          border: 1px solid rgba(136, 170, 196, 0.16);
          padding: 14px;
          box-shadow: 0 8px 22px rgba(56, 88, 120, 0.06);
        }

        .tpm-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        .tpm-panel-title {
          font-size: 18px;
          font-weight: 900;
          color: #31475d;
          line-height: 1.15;
        }

        .tpm-panel-sub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(49, 71, 93, 0.66);
          line-height: 1.3;
        }

        .tpm-clear-btn {
          border: 1px solid rgba(120, 167, 210, 0.18);
          background: rgba(240, 248, 255, 0.95);
          color: #40607c;
          font-weight: 800;
          font-size: 12px;
          border-radius: 10px;
          padding: 8px 10px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          white-space: nowrap;
        }

        .tpm-clear-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(66, 108, 146, 0.08);
        }

        .tpm-current-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .tpm-current-pill,
        .tpm-next-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 11px;
          border-radius: 12px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(120, 167, 210, 0.16);
          font-size: 12px;
          font-weight: 800;
          color: #37546f;
        }

        .tpm-current-pill b,
        .tpm-next-pill b {
          color: #2e445b;
        }

        .tpm-next-pill--done {
          background: rgba(239, 252, 243, 0.95);
          border-color: rgba(92, 186, 117, 0.14);
          color: #2f6c47;
        }

        .tpm-list {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tpm-title-btn {
          width: 100%;
          border: 1px solid rgba(131, 165, 192, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,252,255,0.95));
          border-radius: 14px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
          box-shadow: 0 6px 14px rgba(58, 90, 121, 0.04);
        }

        .tpm-title-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(58, 90, 121, 0.08);
          border-color: rgba(94, 176, 219, 0.26);
        }

        .tpm-title-btn.is-selected {
          border-color: rgba(83, 183, 224, 0.38);
          box-shadow:
            0 0 0 3px rgba(83, 183, 224, 0.12),
            0 10px 22px rgba(58, 90, 121, 0.09);
          background: linear-gradient(180deg, rgba(245,252,255,0.99), rgba(238,248,255,0.97));
        }

        .tpm-title-btn.is-locked {
          cursor: not-allowed;
          opacity: 0.78;
          filter: saturate(0.85);
          background: linear-gradient(180deg, rgba(252,254,255,0.96), rgba(247,250,253,0.95));
        }

        .tpm-title-btn-left {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1 1 auto;
        }

        .tpm-title-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(131, 165, 192, 0.14);
          flex: 0 0 auto;
          font-size: 16px;
        }

        .tpm-title-texts {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tpm-title-label {
          font-size: 14px;
          font-weight: 900;
          color: #2f465d;
          line-height: 1.15;
        }

        .tpm-title-desc {
          font-size: 12px;
          font-weight: 700;
          color: rgba(47, 70, 93, 0.64);
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tpm-title-btn-right {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .tpm-day-chip {
          padding: 6px 8px;
          border-radius: 10px;
          background: rgba(240, 247, 255, 0.96);
          border: 1px solid rgba(131, 165, 192, 0.14);
          font-size: 11px;
          font-weight: 900;
          color: #486580;
        }

        .tpm-pick-chip {
          padding: 6px 9px;
          border-radius: 10px;
          background: rgba(236, 249, 255, 0.96);
          border: 1px solid rgba(84, 185, 225, 0.18);
          color: #2c6f8e;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .tpm-pick-chip.is-selected {
          background: rgba(232, 252, 238, 0.96);
          border-color: rgba(75, 182, 104, 0.18);
          color: #2d8d50;
        }

        .tpm-pick-chip.is-locked {
          background: rgba(245, 248, 252, 0.98);
          border-color: rgba(131, 165, 192, 0.14);
          color: #6b8198;
        }

        .tpm-empty {
          margin-top: 10px;
          border-radius: 14px;
          padding: 14px;
          border: 1px dashed rgba(130, 170, 196, 0.22);
          background: rgba(247, 252, 255, 0.85);
          text-align: center;
        }

        .tpm-empty--soft {
          background: rgba(250, 253, 255, 0.8);
        }

        .tpm-empty-icon {
          font-size: 28px;
          line-height: 1;
        }

        .tpm-empty-title {
          margin-top: 6px;
          font-size: 14px;
          font-weight: 900;
          color: #2f465d;
        }

        .tpm-empty-sub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(47, 70, 93, 0.64);
        }

        @media (max-width: 720px) {
          .tpm-hero-content {
            padding-right: 0;
          }

          .tpm-hippo {
            font-size: 54px;
            right: 8px;
            bottom: 6px;
            opacity: 0.12;
          }

          .tpm-panel-header {
            flex-direction: column;
          }

          .tpm-title-btn {
            align-items: flex-start;
            flex-direction: column;
            gap: 10px;
          }

          .tpm-title-btn-right {
            width: 100%;
            justify-content: space-between;
          }

          .tpm-title-desc {
            white-space: normal;
          }
        }
      `}</style>
    </Modal>
  );
}