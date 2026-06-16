// lib/projects/features.ts
// Чтение флагов фич из projects.features (jsonb).
// Безопасные геттеры с дефолтами + серверные хелперы по slug.

import type { ProjectFeaturesJson, ProjectSlug } from "./types";
import { getProjectBySlug } from "./loader";

// ---------------------------------------------------------------------------
// ГЕТТЕРЫ (синхронные, по объекту features)
// ---------------------------------------------------------------------------

/** Безопасно достать boolean из features. */
function featureBool(features: ProjectFeaturesJson | null | undefined, key: keyof ProjectFeaturesJson): boolean {
  if (!features || typeof features !== "object") return false;
  const v = (features as Record<string, unknown>)[key as string];
  return typeof v === "boolean" ? v : false;
}

/** Серии (streaks) — ежедневная активность, иконки, tiers. */
export function hasStreaks(features: ProjectFeaturesJson | null | undefined): boolean {
  return featureBool(features, "streaks");
}

/** Титулы (titles) — выбираемые пользователем звания. */
export function hasTitles(features: ProjectFeaturesJson | null | undefined): boolean {
  return featureBool(features, "titles");
}

/** Аватарки (avatars) — кастомизация профиля. */
export function hasAvatars(features: ProjectFeaturesJson | null | undefined): boolean {
  return featureBool(features, "avatars");
}

/** Лидерборд (leaderboard). */
export function hasLeaderboard(features: ProjectFeaturesJson | null | undefined): boolean {
  return featureBool(features, "leaderboard");
}

/** Прогресс-блок в профиле. */
export function hasProfileProgress(features: ProjectFeaturesJson | null | undefined): boolean {
  // По умолчанию true, т.к. почти везде нужен
  if (!features || typeof features !== "object") return true;
  const v = (features as Record<string, unknown>).profileProgress;
  return typeof v === "boolean" ? v : true;
}

/**
 * Режим выбора уровня в заявке:
 *  - "class_level"  — одиночный класс (олимпиада: Hippo 1/2/3)
 *  - "target_levels" — массив уровней (экзамены: Stage/CEFR)
 */
export function getRequestMode(
  features: ProjectFeaturesJson | null | undefined,
): "class_level" | "target_levels" {
  const v = (features as Record<string, unknown> | null | undefined)?.requestMode;
  return v === "class_level" ? "class_level" : "target_levels";
}

/** Удобный сводный объект фич. */
export type ProjectFeaturesSummary = {
  streaks: boolean;
  titles: boolean;
  avatars: boolean;
  leaderboard: boolean;
  profileProgress: boolean;
  requestMode: "class_level" | "target_levels";
};

export function summarizeFeatures(features: ProjectFeaturesJson | null | undefined): ProjectFeaturesSummary {
  return {
    streaks: hasStreaks(features),
    titles: hasTitles(features),
    avatars: hasAvatars(features),
    leaderboard: hasLeaderboard(features),
    profileProgress: hasProfileProgress(features),
    requestMode: getRequestMode(features),
  };
}

// ---------------------------------------------------------------------------
// СЕРВЕРНЫЕ ХЕЛПЕРЫ (по slug — с кэшированным конфигом)
// ---------------------------------------------------------------------------

export async function getProjectFeatures(slug: ProjectSlug): Promise<ProjectFeaturesSummary> {
  const project = await getProjectBySlug(slug);
  return summarizeFeatures(project?.features ?? null);
}

export async function projectHasStreaks(slug: ProjectSlug): Promise<boolean> {
  const project = await getProjectBySlug(slug);
  return hasStreaks(project?.features ?? null);
}

export async function projectHasTitles(slug: ProjectSlug): Promise<boolean> {
  const project = await getProjectBySlug(slug);
  return hasTitles(project?.features ?? null);
}

export async function projectHasAvatars(slug: ProjectSlug): Promise<boolean> {
  const project = await getProjectBySlug(slug);
  return hasAvatars(project?.features ?? null);
}

export async function projectHasLeaderboard(slug: ProjectSlug): Promise<boolean> {
  const project = await getProjectBySlug(slug);
  return hasLeaderboard(project?.features ?? null);
}
