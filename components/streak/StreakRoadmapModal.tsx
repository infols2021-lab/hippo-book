"use client";

import { useMemo } from "react";
import Modal from "@/components/Modal";
import * as Roadmap from "@/lib/streaks/roadmap";

type StreakSnapshotLike = {
  today?: string;
  raw_current_streak?: number;
  display_current_streak?: number;
  longest_streak?: number;
  last_completed_date?: string | null;
  done_today?: boolean;
  can_save_today?: boolean;
  tier_code?: string;
} | null;

type NormalizedMilestone = {
  kind: "icon" | "title";
  code: string;
  label: string;
  day: number;
  description?: string;
  iconEmoji?: string;
};

type RoadmapRow = {
  day: number;
  title?: NormalizedMilestone;
  icon?: NormalizedMilestone;
};

type Props = {
  open: boolean;
  onClose: () => void;

  streak?: StreakSnapshotLike;
  loading?: boolean;
  error?: string | null;

  equippedTitleLabel?: string | null;

  unlockedIconCodes?: string[] | null;
  selectedIconCode?: string | null;
  onSelectIconCode?: (code: string) => void;
};

/**
 * ✅ Фоллбек иконок с БОЕВЫМИ кодами (совпадают с bucket v1/defaults/* и roadmap normalizeIconCode)
 * Это критично, чтобы выбор/разблокировка не ломались.
 */
const FALLBACK_ICON_MILESTONES: NormalizedMilestone[] = [
  { kind: "icon", code: "start",        label: "Старт",        day: 1,   description: "Стартовая иконка",            iconEmoji: "✨" },
  { kind: "icon", code: "bronze-1",     label: "Бронза I",     day: 7,   description: "Первая бронзовая иконка",    iconEmoji: "🥉" },
  { kind: "icon", code: "bronze-2",     label: "Бронза II",    day: 14,  description: "Уверенный ритм",             iconEmoji: "🟤" },
  { kind: "icon", code: "silver-1",     label: "Серебро I",    day: 25,  description: "Стабильная серия",           iconEmoji: "🥈" },
  { kind: "icon", code: "silver-2",     label: "Серебро II",   day: 40,  description: "Сильная дисциплина",         iconEmoji: "⚪" },
  { kind: "icon", code: "gold-1",       label: "Золото I",     day: 70,  description: "Плотный прогресс",           iconEmoji: "🥇" },
  { kind: "icon", code: "gold-2",       label: "Золото II",    day: 100, description: "Сотка в серии",              iconEmoji: "🌟" },
  { kind: "icon", code: "platinum-1",   label: "Платина",      day: 150, description: "Особый стиль",               iconEmoji: "🌌" },
  { kind: "icon", code: "diamond-1",    label: "Алмаз",        day: 200, description: "Алмазная серия",             iconEmoji: "💎" },
  { kind: "icon", code: "legendary-1",  label: "Легенда I",    day: 250, description: "Почти легенда",              iconEmoji: "👑" },
  { kind: "icon", code: "legendary-2",  label: "Легенда II",   day: 300, description: "Легендарный путь",           iconEmoji: "🦛" },
];

const FALLBACK_TITLE_MILESTONES: NormalizedMilestone[] = [
  { kind: "title", code: "streak_3_just_joined",       label: "Я только зашёл",      day: 3,   description: "Первый титул за серию" },
  { kind: "title", code: "streak_7_focused",           label: "Целеустремлённый",    day: 7,   description: "7 дней подряд" },
  { kind: "title", code: "streak_14_knowledge",        label: "Идущий к знаниям",    day: 14,  description: "14 дней подряд" },
  { kind: "title", code: "streak_21_discipline",       label: "Железная дисциплина", day: 21,  description: "3 недели подряд" },
  { kind: "title", code: "streak_30_habit_master",     label: "Мастер привычки",     day: 30,  description: "30 дней подряд" },
  { kind: "title", code: "streak_60_unstoppable",      label: "Неостановимый",       day: 60,  description: "60 дней подряд" },
  { kind: "title", code: "streak_100_progress_legend", label: "Легенда прогресса",   day: 100, description: "100 дней подряд" },
];

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function titleCaseFromCode(code: string) {
  return code
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function guessIconEmoji(code: string, label?: string) {
  const s = `${code} ${label ?? ""}`.toLowerCase();

  if (s.includes("start") || s.includes("старт")) return "✨";
  if (s.includes("bronze") || s.includes("бронз")) return "🥉";
  if (s.includes("silver") || s.includes("сереб")) return "🥈";
  if (s.includes("gold") || s.includes("золот")) return "🥇";
  if (s.includes("diamond") || s.includes("алмаз")) return "💎";
  if (s.includes("legend") || s.includes("легенд")) return "👑";
  if (s.includes("platinum") || s.includes("платин") || s.includes("prism")) return "🌌";
  if (s.includes("hippo")) return "🦛";
  return "🎖️";
}

function getObjectValuesWithKeyFallback(source: unknown): any[] {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];

  return Object.entries(source as Record<string, unknown>).map(([key, value]) => {
    if (value && typeof value === "object") {
      return { ...(value as Record<string, unknown>), __key: key };
    }
    return { __key: key, value };
  });
}

function normalizeIncomingIconCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const fn = (Roadmap as any).normalizeIconCode;
  if (typeof fn === "function") {
    try {
      return fn(code);
    } catch {
      return String(code).trim() || null;
    }
  }
  const s = String(code).trim();
  return s || null;
}

function tryNormalizeIconMilestone(row: any, idx: number): NormalizedMilestone | null {
  if (!row || typeof row !== "object") return null;

  // ✅ Поддержка разных имен поля дня (особенно unlockDay)
  const day = num(
    row.day ??
      row.days ??
      row.streak ??
      row.minDays ??
      row.requiredDays ??
      row.unlockAt ??
      row.unlock_at ??
      row.unlockDay ??
      row.unlock_day ??
      row.minStreak ??
      row.min_streak ??
      row.requiredStreak ??
      row.required_streak,
    0
  );
  if (day <= 0) return null;

  const rawCode = String(
    row.code ??
      row.icon_code ??
      row.iconCode ??
      row.id ??
      row.key ??
      row.slug ??
      row.__key ??
      `icon_${idx + 1}`
  ).trim();

  const code = normalizeIncomingIconCode(rawCode) ?? rawCode;
  if (!code) return null;

  const meta = row.meta && typeof row.meta === "object" ? row.meta : null;

  const labelRaw =
    row.label ??
    row.title ??
    row.name ??
    row.shortLabel ??
    row.fullLabel ??
    row.display_name ??
    row.displayName ??
    row.icon_label ??
    row.iconLabel ??
    meta?.label ??
    meta?.title ??
    code;

  const label = String(labelRaw || code).trim();

  const description =
    String(
      row.description ??
        row.desc ??
        row.subtitle ??
        row.note ??
        meta?.description ??
        meta?.desc ??
        ""
    ).trim() || undefined;

  const iconEmoji = String(
    row.emoji ??
      row.iconEmoji ??
      row.placeholderEmoji ??
      meta?.emoji ??
      guessIconEmoji(code, label)
  ).trim();

  return {
    kind: "icon",
    code,
    label,
    day,
    description,
    iconEmoji,
  };
}

function tryNormalizeTitleMilestone(row: any, idx: number): NormalizedMilestone | null {
  if (!row || typeof row !== "object") return null;

  const day = num(
    row.day ??
      row.days ??
      row.streak ??
      row.minDays ??
      row.requiredDays ??
      row.unlockDay ??
      row.unlock_day ??
      row.minStreak ??
      row.min_streak ??
      row.requiredStreak ??
      row.required_streak,
    0
  );
  if (day <= 0) return null;

  const code = String(
    row.code ??
      row.title_code ??
      row.titleCode ??
      row.id ??
      row.key ??
      row.slug ??
      row.__key ??
      `title_${idx + 1}`
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
  const description = String(row.description ?? row.desc ?? row.subtitle ?? row.note ?? "").trim() || undefined;

  return {
    kind: "title",
    code,
    label,
    day,
    description,
  };
}

function dedupeMilestones(list: NormalizedMilestone[]) {
  const map = new Map<string, NormalizedMilestone>();
  for (const item of list) {
    const key = `${item.kind}:${item.code}:${item.day}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => a.day - b.day || a.label.localeCompare(b.label, "ru"));
}

function pickRoadmapArrays() {
  const r: any = Roadmap as any;

  const rawIcons =
    r.STREAK_ICON_MILESTONES ??
    r.STREAK_ICON_VARIANTS ??
    r.STREAK_ICON_REWARDS ??
    r.ICON_ROADMAP ??
    r.iconRoadmap ??
    r.STREAK_ICONS ??
    null;

  const rawTitles =
    r.STREAK_TITLE_MILESTONES ??
    r.STREAK_TITLE_REWARDS ??
    r.TITLE_ROADMAP ??
    r.titleRoadmap ??
    r.STREAK_TITLES ??
    null;

  const iconRowsSrc = getObjectValuesWithKeyFallback(rawIcons);
  const titleRowsSrc = getObjectValuesWithKeyFallback(rawTitles);

  const iconRows = iconRowsSrc.map(tryNormalizeIconMilestone).filter(Boolean) as NormalizedMilestone[];
  const titleRows = titleRowsSrc.map(tryNormalizeTitleMilestone).filter(Boolean) as NormalizedMilestone[];

  const icons = dedupeMilestones(iconRows.length ? iconRows : FALLBACK_ICON_MILESTONES);
  const titles = dedupeMilestones(titleRows.length ? titleRows : FALLBACK_TITLE_MILESTONES);

  return { icons, titles };
}

function getUnlockedIconsByLongest(longest: number, iconMilestones: NormalizedMilestone[]) {
  const fn = (Roadmap as any).getUnlockedIconCodesByLongest;
  if (typeof fn === "function") {
    try {
      const value = fn(longest);
      if (Array.isArray(value)) {
        return new Set(
          value
            .map((v) => normalizeIncomingIconCode(String(v)))
            .filter(Boolean)
            .map(String)
        );
      }
    } catch {
      // fallback ниже
    }
  }

  return new Set(iconMilestones.filter((m) => m.day <= longest).map((m) => String(m.code)));
}

function resolveTierCodeForUi(currentStreak: number, serverTierCode?: string) {
  const fn = (Roadmap as any).getTierCodeByStreak;
  if (typeof fn === "function") {
    try {
      const t = fn(currentStreak);
      if (typeof t === "string" && t.trim()) return t.trim();
    } catch {
      // fallback to server tier
    }
  }
  return String(serverTierCode || "").trim().toLowerCase();
}

function getTierBadge(tierCode?: string, streakValue?: number) {
  const s = String(tierCode || "").toLowerCase();
  const v = Math.max(0, num(streakValue));

  if (s === "legendary") return { icon: "👑", label: "Легендарный" };
  if (s === "diamond") return { icon: "💎", label: "Алмазный" };
  if (s === "platinum") return { icon: "🌌", label: "Платиновый" };
  if (s === "gold") return { icon: "🥇", label: "Золотой" };
  if (s === "silver") return { icon: "🥈", label: "Серебряный" };
  if (s === "bronze") return { icon: "🥉", label: "Бронзовый" };
  return { icon: v > 0 ? "🔥" : "✨", label: v > 0 ? "Серия" : "Нет серии" };
}

function buildRoadmapRows(icons: NormalizedMilestone[], titles: NormalizedMilestone[]): RoadmapRow[] {
  const map = new Map<number, RoadmapRow>();

  const put = (m: NormalizedMilestone) => {
    const day = Math.max(1, num(m.day));
    const row = map.get(day) ?? { day };
    if (m.kind === "title") {
      if (!row.title) row.title = m;
    } else {
      if (!row.icon) row.icon = m;
    }
    map.set(day, row);
  };

  titles.forEach(put);
  icons.forEach(put);

  return [...map.values()].sort((a, b) => a.day - b.day);
}

function computeRailProgressPercent(currentStreak: number, rows: RoadmapRow[]) {
  const s = Math.max(0, num(currentStreak));
  if (!rows.length) return 0;
  if (rows.length === 1) return s >= rows[0].day ? 100 : 0;

  const firstDay = rows[0].day;
  const lastDay = rows[rows.length - 1].day;

  if (s <= firstDay) {
    // небольшой прогресс к первой точке (чтобы линия не выглядела "мертвой" на старте)
    return clamp((s / Math.max(1, firstDay)) * (100 / Math.max(1, rows.length - 1)) * 0.35, 0, 100);
  }
  if (s >= lastDay) return 100;

  let prevIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].day <= s) prevIndex = i;
    else break;
  }

  const nextIndex = Math.min(rows.length - 1, prevIndex + 1);
  const prevDay = rows[prevIndex].day;
  const nextDay = rows[nextIndex].day;

  if (nextIndex === prevIndex) return 100;

  const segmentProgress = clamp((s - prevDay) / Math.max(1, nextDay - prevDay), 0, 1);
  const virtualIndex = prevIndex + segmentProgress;
  const totalSegments = Math.max(1, rows.length - 1);
  return clamp((virtualIndex / totalSegments) * 100, 0, 100);
}

// "Следующая новая награда" — по рекорду (longest), т.к. награды не сгорают
function isMilestoneUnlockedByLongest(
  milestone: NormalizedMilestone,
  longestStreak: number,
  unlockedIconSet: Set<string>
) {
  if (milestone.kind === "icon") {
    const code = normalizeIncomingIconCode(milestone.code) ?? milestone.code;
    return unlockedIconSet.has(String(code)) || longestStreak >= milestone.day;
  }
  return longestStreak >= milestone.day;
}

export default function StreakRoadmapModal({
  open,
  onClose,
  streak,
  loading = false,
  error = null,
  equippedTitleLabel = null,
  unlockedIconCodes = null,
  selectedIconCode = null,
  onSelectIconCode,
}: Props) {
  const currentStreak = Math.max(0, num(streak?.display_current_streak));
  const longestStreak = Math.max(0, num(streak?.longest_streak));
  const doneToday = Boolean(streak?.done_today);

  const resolvedTierCode = resolveTierCodeForUi(currentStreak, streak?.tier_code);
  const tierBadge = getTierBadge(resolvedTierCode, currentStreak);

  const { icons, titles } = useMemo(() => pickRoadmapArrays(), []);
  const roadmapRows = useMemo(() => buildRoadmapRows(icons, titles), [icons, titles]);

  const mergedRoadmap = useMemo(() => {
    return [...titles, ...icons].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.kind !== b.kind) return a.kind === "title" ? -1 : 1;
      return a.label.localeCompare(b.label, "ru");
    });
  }, [icons, titles]);

  const unlockedSet = useMemo(() => {
    if (Array.isArray(unlockedIconCodes) && unlockedIconCodes.length > 0) {
      return new Set(
        unlockedIconCodes
          .map((c) => normalizeIncomingIconCode(String(c)))
          .filter(Boolean)
          .map(String)
      );
    }
    return getUnlockedIconsByLongest(longestStreak, icons);
  }, [unlockedIconCodes, longestStreak, icons]);

  const effectiveSelectedIconCode = useMemo(() => {
    const normalizedSelected = normalizeIncomingIconCode(selectedIconCode);
    if (normalizedSelected && unlockedSet.has(String(normalizedSelected))) {
      return String(normalizedSelected);
    }

    // автоподбор = последняя разблокированная
    const latestUnlocked = [...icons]
      .sort((a, b) => a.day - b.day)
      .filter((i) => unlockedSet.has(String(normalizeIncomingIconCode(i.code) ?? i.code)))
      .at(-1);

    return latestUnlocked?.code ?? null;
  }, [selectedIconCode, unlockedSet, icons]);

  const selectedIcon = icons.find(
    (i) => (normalizeIncomingIconCode(i.code) ?? i.code) === effectiveSelectedIconCode
  ) ?? null;

  // Следующая награда — первая еще не открытая по рекорду
  const nextReward = useMemo(() => {
    const next =
      mergedRoadmap.find((m) => !isMilestoneUnlockedByLongest(m, longestStreak, unlockedSet)) ?? null;

    if (!next) return null;

    return {
      ...next,
      left: Math.max(0, next.day - currentStreak),
    };
  }, [mergedRoadmap, longestStreak, unlockedSet, currentStreak]);

  const lineProgressPercent = useMemo(
    () => computeRailProgressPercent(currentStreak, roadmapRows),
    [currentStreak, roadmapRows]
  );

  return (
    <Modal open={open} onClose={onClose} title="🔥 Дорожка серии" maxWidth={1180}>
      <div className="streak-roadmap-modal">
        {/* Верхняя панель */}
        <div className="srm-top-grid">
          <div className="srm-stat-card srm-stat-card--warm">
            <div className="srm-stat-icon">🔥</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{loading ? "…" : `${currentStreak} дн.`}</div>
              <div className="srm-stat-label">Текущая серия</div>
            </div>
          </div>

          <div className="srm-stat-card srm-stat-card--cool">
            <div className="srm-stat-icon">🏆</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{loading ? "…" : `${longestStreak} дн.`}</div>
              <div className="srm-stat-label">Рекорд</div>
            </div>
          </div>

          <div className={`srm-stat-card ${doneToday ? "srm-stat-card--done" : "srm-stat-card--todo"}`}>
            <div className="srm-stat-icon">{doneToday ? "✅" : "📅"}</div>
            <div className="srm-stat-content">
              <div className="srm-stat-value">{doneToday ? "Засчитано" : "Не засчитано"}</div>
              <div className="srm-stat-label">
                {loading ? "..." : doneToday ? "Сегодня" : "Сделай задание сегодня"}
              </div>
            </div>
          </div>
        </div>

        <div className="srm-status-line">
          <div className="srm-status-pill">
            <span>{tierBadge.icon}</span>
            <b>{tierBadge.label}</b>
          </div>
          <div className="srm-status-pill">
            <span>🏷️</span>
            <b>{equippedTitleLabel?.trim() || "Титул не выбран"}</b>
          </div>
          {error ? (
            <div className="srm-status-pill srm-status-pill--error">
              <span>⚠️</span>
              <b>{error}</b>
            </div>
          ) : null}
        </div>

        {/* Следующая награда */}
        <section className="srm-panel srm-next-panel">
          <div className="srm-panel-title">Следующая награда</div>

          {!nextReward ? (
            <div className="srm-next-final">
              <div className="srm-next-final-icon">🚀</div>
              <div>
                <div className="srm-next-final-title">Все награды в текущей дорожке уже открыты</div>
                <div className="srm-next-final-sub">
                  Позже можно добавить новые уровни (иконки / титулы / фоны)
                </div>
              </div>
            </div>
          ) : (
            <div className="srm-next-card">
              <div className="srm-next-kind">
                {nextReward.kind === "title" ? "🏷️ Титул" : "🎖️ Иконка"}
              </div>
              <div className="srm-next-main">
                <div className="srm-next-name">{nextReward.label}</div>
                <div className="srm-next-sub">
                  На <b>{nextReward.day}</b> дне • осталось <b>{nextReward.left}</b>{" "}
                  {nextReward.left === 1 ? "день" : nextReward.left >= 2 && nextReward.left <= 4 ? "дня" : "дней"}
                </div>
              </div>
              <div className="srm-next-badge">+{nextReward.left}</div>
            </div>
          )}
        </section>

        {/* Иконки серии */}
        <section className="srm-panel">
          <div className="srm-panel-header">
            <div>
              <div className="srm-panel-title">Иконки серии</div>
              <div className="srm-panel-subtitle">
                Разблокированные иконки можно выбирать. Автовыбор — последняя открытая.
              </div>
            </div>
          </div>

          <div className="srm-icons-grid">
            {icons.map((m) => {
              const normalizedCode = normalizeIncomingIconCode(m.code) ?? m.code;
              const unlocked = unlockedSet.has(normalizedCode);
              const selected = effectiveSelectedIconCode === normalizedCode;

              return (
                <button
                  key={`icon-${normalizedCode}-${m.day}`}
                  type="button"
                  className={[
                    "srm-icon-tile",
                    unlocked ? "is-unlocked" : "is-locked",
                    selected ? "is-selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    if (!unlocked) return;
                    onSelectIconCode?.(normalizedCode);
                  }}
                  disabled={!unlocked}
                  title={
                    unlocked
                      ? `${m.label} • ${m.day} дн.`
                      : `${m.label} • откроется на ${m.day} дне`
                  }
                >
                  <div className="srm-icon-tile-top">
                    <div className="srm-icon-ball" aria-hidden="true">
                      {m.iconEmoji || "🎖️"}
                    </div>
                    {!unlocked ? <div className="srm-lock-badge">🔒</div> : null}
                  </div>

                  <div className="srm-icon-title">{m.label}</div>
                  <div className="srm-icon-day">{m.day}д</div>

                  <div className="srm-icon-meta">
                    {selected ? "Выбрано" : unlocked ? "Разблокировано" : "Заблокировано"}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="srm-selected-row">
            <span className="srm-selected-label">Текущая выбранная:</span>
            <span className="srm-selected-pill">
              <span>{selectedIcon?.iconEmoji || "🎖️"}</span>
              <b>{selectedIcon?.label || "—"}</b>
            </span>
            {selectedIcon?.description ? (
              <span className="srm-selected-sub">{selectedIcon.description}</span>
            ) : null}
          </div>
        </section>

        {/* Дорожка наград */}
        <section className="srm-panel">
          <div className="srm-panel-title">Дорожка наград</div>
          <div className="srm-panel-subtitle">
            Полоса серии по центру. <b>Титулы — слева</b>, <b>иконки — справа</b>. Награды одного дня идут в одной строке.
          </div>

          <div className="srm-roadmap-wrap">
            {/* Центральная полоса */}
            <div className="srm-center-rail" aria-hidden="true">
              <div className="srm-center-rail-track" />
              <div
                className="srm-center-rail-progress"
                style={{ height: `${lineProgressPercent}%` }}
              />
              <div
                className="srm-center-progress-bubble"
                style={{ top: `clamp(0px, calc(${lineProgressPercent}% - 18px), calc(100% - 36px))` }}
                title={`Текущий стрик: ${currentStreak} дн.`}
              >
                🔥 {loading ? "…" : `${currentStreak}д`}
              </div>
            </div>

            <div className="srm-roadmap-list">
              {roadmapRows.map((row) => {
                const rowUnlockedByLongest = longestStreak >= row.day;
                const rowReachedByCurrent = currentStreak >= row.day;
                const isCurrentTarget = !!nextReward && nextReward.day === row.day;

                const nodeEmoji =
                  row.icon?.iconEmoji ||
                  (row.title ? "🏷️" : "🎯");

                return (
                  <div
                    key={`day-${row.day}`}
                    className={`srm-road-row ${rowUnlockedByLongest ? "is-unlocked" : ""} ${isCurrentTarget ? "is-next" : ""}`}
                  >
                    {/* LEFT — ТИТУЛ */}
                    <div className="srm-road-side srm-road-side--left">
                      {row.title ? (
                        <div className="srm-road-card srm-road-card--title">
                          <div className="srm-road-card-top">
                            <span className="srm-kind-chip srm-kind-chip--title">🏷️ Титул</span>
                            <span className={`srm-state-chip ${longestStreak >= row.title.day ? "ok" : "lock"}`}>
                              {longestStreak >= row.title.day ? "Открыт" : `На ${row.title.day} дне`}
                            </span>
                          </div>

                          <div className="srm-road-card-day">{row.title.day} дн.</div>
                          <div className="srm-road-card-title">{row.title.label}</div>
                          <div className="srm-road-card-desc">
                            {row.title.description || "Награда за поддержание серии"}
                          </div>
                        </div>
                      ) : (
                        <div className="srm-road-placeholder" />
                      )}
                    </div>

                    {/* CENTER NODE */}
                    <div className="srm-road-center">
                      <div className={`srm-node ${rowReachedByCurrent ? "is-reached" : ""} ${isCurrentTarget ? "is-next" : ""}`}>
                        {nodeEmoji}
                      </div>
                      <div className="srm-node-day">{row.day}д</div>
                    </div>

                    {/* RIGHT — ИКОНКА */}
                    <div className="srm-road-side srm-road-side--right">
                      {row.icon ? (
                        <div className="srm-road-card srm-road-card--icon">
                          <div className="srm-road-card-top">
                            <span className="srm-kind-chip srm-kind-chip--icon">🎖️ Иконка</span>
                            <span className={`srm-state-chip ${unlockedSet.has(normalizeIncomingIconCode(row.icon.code) ?? row.icon.code) ? "ok" : "lock"}`}>
                              {unlockedSet.has(normalizeIncomingIconCode(row.icon.code) ?? row.icon.code)
                                ? "Открыта"
                                : `На ${row.icon.day} дне`}
                            </span>
                          </div>

                          <div className="srm-road-card-inline">
                            <div className="srm-road-card-iconBall">{row.icon.iconEmoji || "🎖️"}</div>
                            <div className="srm-road-card-inlineText">
                              <div className="srm-road-card-day">{row.icon.day} дн.</div>
                              <div className="srm-road-card-title">{row.icon.label}</div>
                              <div className="srm-road-card-desc">
                                {row.icon.description || "Новая иконка профиля"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="srm-road-placeholder" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .streak-roadmap-modal {
          display: flex;
          flex-direction: column;
          gap: 18px;
          color: #273444;
        }

        .srm-panel {
          background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(245,250,255,0.92));
          border: 1px solid rgba(136, 170, 196, 0.18);
          border-radius: 20px;
          padding: 16px;
          box-shadow:
            0 10px 28px rgba(56, 88, 120, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.75);
        }

        .srm-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .srm-panel-title {
          font-size: 20px;
          font-weight: 900;
          line-height: 1.15;
          color: #314457;
        }

        .srm-panel-subtitle {
          margin-top: 6px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(49, 68, 87, 0.68);
          line-height: 1.35;
        }

        .srm-top-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .srm-stat-card {
          border-radius: 18px;
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(116, 145, 174, 0.16);
          box-shadow: 0 8px 22px rgba(39, 58, 83, 0.06);
          min-height: 84px;
        }

        .srm-stat-card--warm {
          background: linear-gradient(135deg, rgba(255,247,236,0.96), rgba(255,240,224,0.9));
        }

        .srm-stat-card--cool {
          background: linear-gradient(135deg, rgba(243,248,255,0.97), rgba(236,244,255,0.92));
        }

        .srm-stat-card--done {
          background: linear-gradient(135deg, rgba(235,252,240,0.98), rgba(223,247,231,0.93));
        }

        .srm-stat-card--todo {
          background: linear-gradient(135deg, rgba(255,249,232,0.98), rgba(255,244,214,0.92));
        }

        .srm-stat-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(116,145,174,0.16);
          font-size: 24px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
          flex: 0 0 auto;
        }

        .srm-stat-content {
          min-width: 0;
        }

        .srm-stat-value {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.05;
          color: #263a4e;
        }

        .srm-stat-label {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 800;
          color: rgba(38, 58, 78, 0.62);
        }

        .srm-status-line {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: -2px;
        }

        .srm-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.85);
          border: 1px solid rgba(116,145,174,0.16);
          font-size: 13px;
          font-weight: 800;
          color: #33475c;
        }

        .srm-status-pill--error {
          background: rgba(255, 241, 241, 0.92);
          border-color: rgba(220, 65, 65, 0.18);
          color: #a53030;
        }

        .srm-next-panel {
          padding-top: 14px;
        }

        .srm-next-card {
          margin-top: 10px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(240,247,255,0.98), rgba(232,244,255,0.94));
          border: 1px solid rgba(111, 154, 201, 0.16);
        }

        .srm-next-kind {
          font-size: 12px;
          font-weight: 900;
          color: #3f5a76;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(111,154,201,0.14);
          padding: 8px 10px;
          border-radius: 999px;
          white-space: nowrap;
        }

        .srm-next-main {
          min-width: 0;
        }

        .srm-next-name {
          font-size: 19px;
          font-weight: 900;
          color: #2d4156;
          line-height: 1.1;
        }

        .srm-next-sub {
          margin-top: 4px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(45,65,86,0.72);
        }

        .srm-next-badge {
          font-size: 18px;
          font-weight: 900;
          color: #2f6fb5;
          background: rgba(255,255,255,0.86);
          border: 1px solid rgba(111,154,201,0.14);
          border-radius: 12px;
          padding: 8px 12px;
        }

        .srm-next-final {
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(242,255,245,0.97), rgba(236,251,240,0.93));
          border: 1px solid rgba(88, 176, 114, 0.14);
        }

        .srm-next-final-icon {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(255,255,255,0.86);
          font-size: 22px;
        }

        .srm-next-final-title {
          font-size: 16px;
          font-weight: 900;
          color: #2f4b3c;
        }

        .srm-next-final-sub {
          margin-top: 3px;
          font-size: 13px;
          font-weight: 700;
          color: rgba(47,75,60,0.68);
        }

        .srm-icons-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .srm-icon-tile {
          border-radius: 16px;
          border: 1px solid rgba(129, 157, 183, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,251,255,0.95));
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          min-height: 136px;
          cursor: pointer;
          transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
          box-shadow: 0 6px 18px rgba(57, 89, 122, 0.06);
        }

        .srm-icon-tile:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(57, 89, 122, 0.1);
        }

        .srm-icon-tile:disabled {
          cursor: not-allowed;
        }

        .srm-icon-tile.is-locked {
          opacity: 0.72;
          filter: grayscale(0.15);
        }

        .srm-icon-tile.is-selected {
          border-color: rgba(74, 180, 220, 0.58);
          box-shadow:
            0 0 0 3px rgba(87, 208, 226, 0.15),
            0 10px 28px rgba(60, 153, 194, 0.14);
          background: linear-gradient(180deg, rgba(246,252,255,1), rgba(236,249,255,0.98));
        }

        .srm-icon-tile-top {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          min-height: 44px;
        }

        .srm-icon-ball {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-size: 24px;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(129,157,183,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.82);
        }

        .srm-lock-badge {
          position: absolute;
          top: -2px;
          right: -2px;
          font-size: 14px;
          background: rgba(255,255,255,0.95);
          border-radius: 999px;
          padding: 2px 5px;
          border: 1px solid rgba(129,157,183,0.18);
        }

        .srm-icon-title {
          margin-top: 2px;
          font-size: 13px;
          line-height: 1.15;
          font-weight: 900;
          text-align: center;
          color: #34485e;
        }

        .srm-icon-day {
          font-size: 12px;
          font-weight: 900;
          color: rgba(52,72,94,0.64);
        }

        .srm-icon-meta {
          margin-top: auto;
          font-size: 11px;
          font-weight: 800;
          color: rgba(52,72,94,0.6);
          text-align: center;
        }

        .srm-icon-tile.is-selected .srm-icon-meta {
          color: #3fa7c6;
        }

        .srm-selected-row {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .srm-selected-label {
          font-size: 13px;
          font-weight: 800;
          color: rgba(47,64,82,0.72);
        }

        .srm-selected-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(238,249,255,0.96);
          border: 1px solid rgba(78,181,219,0.2);
          color: #35607a;
          font-size: 13px;
        }

        .srm-selected-sub {
          font-size: 12px;
          font-weight: 700;
          color: rgba(53,96,122,0.72);
        }

        /* Roadmap */
        .srm-roadmap-wrap {
          position: relative;
          margin-top: 14px;
          background:
            radial-gradient(circle at 20% 0%, rgba(135, 206, 235, 0.08), transparent 40%),
            radial-gradient(circle at 80% 0%, rgba(161, 193, 255, 0.08), transparent 42%),
            linear-gradient(180deg, rgba(248,252,255,0.86), rgba(243,250,255,0.9));
          border: 1px solid rgba(136,170,196,0.14);
          border-radius: 22px;
          padding: 18px 14px;
          overflow: hidden;
        }

        .srm-center-rail {
          position: absolute;
          left: 50%;
          top: 18px;
          bottom: 18px;
          width: 0;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 1;
        }

        .srm-center-rail-track {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          transform: translateX(-50%);
          width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(209,225,240,0.85), rgba(197,219,238,0.7));
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.75);
        }

        .srm-center-rail-progress {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          width: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffd16e 0%, #ff9e43 45%, #ff6a3a 100%);
          box-shadow:
            0 0 0 4px rgba(255, 154, 67, 0.08),
            0 6px 16px rgba(255, 120, 63, 0.2);
        }

        .srm-center-progress-bubble {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(255, 139, 64, 0.2);
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 900;
          color: #be5c22;
          box-shadow: 0 8px 22px rgba(255, 129, 55, 0.14);
          white-space: nowrap;
        }

        .srm-roadmap-list {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .srm-road-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 92px minmax(0, 1fr);
          align-items: stretch;
          gap: 12px;
          min-height: 124px;
        }

        .srm-road-side {
          min-height: 1px;
          display: flex;
          align-items: center;
        }

        .srm-road-side > * {
          width: 100%;
        }

        .srm-road-placeholder {
          height: 1px;
        }

        .srm-road-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 124px;
        }

        .srm-node {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          font-size: 20px;
          background: rgba(255,255,255,0.98);
          border: 1px solid rgba(136,170,196,0.2);
          box-shadow: 0 6px 16px rgba(58, 87, 117, 0.08);
          transition: transform 0.15s ease;
        }

        .srm-node.is-reached {
          border-color: rgba(255, 145, 68, 0.25);
          box-shadow:
            0 0 0 4px rgba(255, 155, 85, 0.09),
            0 8px 20px rgba(255, 142, 77, 0.16);
          background: linear-gradient(180deg, rgba(255,255,255,0.99), rgba(255,247,240,0.98));
        }

        .srm-node.is-next {
          transform: scale(1.06);
        }

        .srm-node-day {
          font-size: 11px;
          font-weight: 900;
          color: rgba(44, 63, 82, 0.66);
          background: rgba(255,255,255,0.94);
          border: 1px solid rgba(136,170,196,0.14);
          padding: 4px 8px;
          border-radius: 999px;
          line-height: 1;
        }

        .srm-road-card {
          border-radius: 18px;
          border: 1px solid rgba(136,170,196,0.16);
          background: rgba(255,255,255,0.94);
          padding: 12px;
          box-shadow: 0 8px 22px rgba(56, 86, 116, 0.06);
          min-height: 104px;
        }

        .srm-road-card--title {
          background: linear-gradient(135deg, rgba(246,250,255,0.98), rgba(241,248,255,0.95));
        }

        .srm-road-card--icon {
          background: linear-gradient(135deg, rgba(255,250,242,0.98), rgba(255,247,235,0.94));
        }

        .srm-road-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .srm-kind-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          border: 1px solid rgba(136,170,196,0.14);
          white-space: nowrap;
        }

        .srm-kind-chip--title {
          background: rgba(236,244,255,0.98);
          color: #45617d;
        }

        .srm-kind-chip--icon {
          background: rgba(255,243,227,0.98);
          color: #8a5a2c;
        }

        .srm-state-chip {
          border-radius: 999px;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          border: 1px solid transparent;
        }

        .srm-state-chip.ok {
          background: rgba(231, 250, 236, 0.98);
          color: #2d8b52;
          border-color: rgba(45, 139, 82, 0.12);
        }

        .srm-state-chip.lock {
          background: rgba(244,247,251,0.98);
          color: #6a7f96;
          border-color: rgba(106,127,150,0.12);
        }

        .srm-road-card-day {
          font-size: 18px;
          font-weight: 900;
          color: #2c4155;
          line-height: 1.1;
        }

        .srm-road-card-title {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 900;
          color: #2f465d;
          line-height: 1.15;
        }

        .srm-road-card-desc {
          margin-top: 5px;
          font-size: 12px;
          font-weight: 700;
          color: rgba(47,70,93,0.66);
          line-height: 1.3;
        }

        .srm-road-card-inline {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
        }

        .srm-road-card-iconBall {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          font-size: 26px;
          background: rgba(255,255,255,0.95);
          border: 1px solid rgba(136,170,196,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .srm-road-card-inlineText {
          min-width: 0;
        }

        @media (max-width: 1100px) {
          .srm-icons-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .srm-top-grid {
            grid-template-columns: 1fr;
          }

          .srm-icons-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .srm-roadmap-wrap {
            padding-left: 10px;
            padding-right: 10px;
          }

          .srm-road-row {
            grid-template-columns: 1fr;
            gap: 8px;
            padding-left: 52px;
            position: relative;
            min-height: unset;
          }

          .srm-center-rail {
            left: 26px;
          }

          .srm-road-center {
            position: absolute;
            left: 0;
            top: 12px;
            width: 52px;
            min-height: unset;
          }

          .srm-road-side--left,
          .srm-road-side--right {
            width: 100%;
          }

          .srm-road-placeholder {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .srm-icons-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .srm-next-card {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .srm-next-badge {
            justify-self: start;
          }

          .srm-road-card-top {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </Modal>
  );
}