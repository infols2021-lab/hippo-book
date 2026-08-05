// lib/projects/theme.ts
// Применение темы проекта (theme jsonb → CSS-переменные / className).
// Серверная (buildCssVars) и клиентская (applyTheme) версии.

import type { ProjectThemeConfig, ProjectThemeColors, ProjectSlug } from "./types";
import { getProjectBySlug } from "./loader";

// ---------------------------------------------------------------------------
// КАРТА colors → CSS custom property
// ---------------------------------------------------------------------------

/** CSS-переменные, которые проставляются из colors проекта. */
const COLOR_VARS: Array<{ key: keyof ProjectThemeColors; varName: string }> = [
  { key: "pageBg", varName: "--p-page-bg" },
  { key: "cardBg", varName: "--p-card-bg" },
  { key: "cardBgSoft", varName: "--p-card-bg-soft" },
  { key: "primary", varName: "--p-primary" },
  { key: "primarySoft", varName: "--p-primary-soft" },
  { key: "secondary", varName: "--p-secondary" },
  { key: "accent", varName: "--p-accent" },
  { key: "accentSoft", varName: "--p-accent-soft" },
  { key: "text", varName: "--p-text" },
  { key: "muted", varName: "--p-muted" },
  { key: "border", varName: "--p-border" },
  { key: "glow", varName: "--p-glow" },
];

/**
 * Алиасы для совместимости со старыми переменными (--accent2, --project-* и т.п.).
 * Много компонентов и *.css файлов в проекте исторически написаны на этих старых
 * именах (--project-primary, --project-text, --project-card-bg, --project-bg,
 * --project-secondary) — раньше applyTheme() их не обновлял, и они навсегда
 * оставались дефолтными (тёмными) значениями из :root в globals.css, из-за чего
 * модалки/формы не подхватывали тему проекта. Теперь прокидываем их тоже.
 */
const LEGACY_ALIASES: Array<{ from: keyof ProjectThemeColors; varName: string }> = [
  { from: "primary", varName: "--accent2" },
  { from: "primarySoft", varName: "--accent2-soft" },
  { from: "primary", varName: "--project-primary" },
  { from: "secondary", varName: "--project-secondary" },
  { from: "pageBg", varName: "--project-bg" },
  { from: "cardBg", varName: "--project-card-bg" },
  { from: "text", varName: "--project-text" },
];

// ---------------------------------------------------------------------------
// СЕРВЕР: генерация строки CSS
// ---------------------------------------------------------------------------

export type ProjectCssVars = {
  /** Inline-стиль для style={{ ...cssVars.style }} */
  style: Record<string, string>;
  /** className корневого элемента (rootClassName из темы). */
  className: string;
  /** Готовая строка для <style> (если нужно глобально). */
  cssText: string;
};

/**
 * Строит CSS-переменные из темы проекта.
 * Серверная функция — использует theme из уже загруженного конфига.
 */
export function buildCssVars(theme: ProjectThemeConfig): ProjectCssVars {
  const style: Record<string, string> = {};

  for (const { key, varName } of COLOR_VARS) {
    const value = theme.colors[key];
    if (value) style[varName] = value;
  }

  // Алиасы для legacy CSS (старые компоненты ссылаются на --accent2, --project-* и т.п.)
  for (const { from, varName } of LEGACY_ALIASES) {
    const value = theme.colors[from];
    if (value && !style[varName]) style[varName] = value;
  }

  if (theme.fontFamily && theme.fontFamily !== "inherit") {
    style["--p-font-family"] = theme.fontFamily;
  }

  const cssText = Object.entries(style)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");

  return {
    style,
    className: theme.rootClassName,
    cssText,
  };
}

/** Серверный хелпер: тема + CSS-переменные по slug проекта. */
export async function getProjectThemeCssVars(slug: ProjectSlug): Promise<ProjectCssVars | null> {
  const project = await getProjectBySlug(slug);
  if (!project) return null;
  return buildCssVars(project.theme);
}

// ---------------------------------------------------------------------------
// КЛИЕНТ: применение темы к DOM
// ---------------------------------------------------------------------------

/**
 * Применяет тему к HTML-элементу (документу или контейнеру).
 * Клиентская функция — вызывает после загрузки конфига с сервера.
 */
export function applyTheme(
  theme: ProjectThemeConfig,
  options: { target?: HTMLElement; scope?: "global" | "local" } = {},
): void {
  const target = options.target ?? document.documentElement;
  const { style, className } = buildCssVars(theme);

  for (const [k, v] of Object.entries(style)) {
    target.style.setProperty(k, v);
  }

  if (options.scope === "global" && className) {
    if (!document.documentElement.classList.contains(className)) {
      document.documentElement.classList.add(className);
    }
  }
}

/** Снимает тему с элемента (полезно при размонтировании/смене ветки). */
export function removeTheme(
  theme: ProjectThemeConfig,
  options: { target?: HTMLElement; scope?: "global" | "local" } = {},
): void {
  const target = options.target ?? document.documentElement;
  const { style, className } = buildCssVars(theme);

  for (const k of Object.keys(style)) {
    target.style.removeProperty(k);
  }

  if (options.scope === "global" && className) {
    document.documentElement.classList.remove(className);
  }
}

// ---------------------------------------------------------------------------
// УТИЛИТЫ ДЛЯ РЕНДЕРА
// ---------------------------------------------------------------------------

/**
 * Превращает colors темы в объект для инлайн-стиля React.
 * Например: style={{ background: themeColor('pageBg', theme) }}
 */
export function themeColor(key: keyof ProjectThemeColors, theme: ProjectThemeConfig): string {
  return theme.colors[key] ?? "";
}

/** Все CSS-переменные как объект для React style={{}}. */
export function themeStyle(theme: ProjectThemeConfig): Record<string, string> {
  return buildCssVars(theme).style;
}