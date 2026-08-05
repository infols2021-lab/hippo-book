import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

// Умный хелпер для определения яркости цвета (светлая или темная тема)
function isDark(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return false;

  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);

  // Формула воспринимаемой яркости (Luminance)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128; // Если меньше 128 — значит цвет тёмный
}

/**
 * Значения темы приходят из БД (project.theme) и попадают в <style> через
 * dangerouslySetInnerHTML. Без проверки это открытая дыра для CSS/HTML-инъекции
 * (кто-то мог бы записать в theme.colors.primary что-то вроде
 * `red;}</style><script>...`). Разрешаем только безопасные для CSS-значения цвета
 * символы: hex, rgb()/rgba()/hsl()/color-mix(), проценты, запятые, пробелы, точки.
 */
function sanitizeCssColor(value: string, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return fallback;
  if (!/^[#a-zA-Z0-9(),.%\s-]+$/.test(trimmed)) return fallback;
  return trimmed;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_active, theme, theme_color")
    .eq("slug", slug)
    .single();

  if (!project || project.is_active === false) {
    notFound();
  }

  const theme = project.theme || {};

  // Базовые цвета (сначала берём "сырые" значения, потом санитизируем)
  const primaryColor = sanitizeCssColor(
    theme?.colors?.primary || theme?.primaryColor || project.theme_color || "#0ea5e9",
    "#0ea5e9",
  );
  const secondaryColor = sanitizeCssColor(
    theme?.colors?.secondary || theme?.secondaryColor || "#38bdf8",
    "#38bdf8",
  );
  const bgColor = sanitizeCssColor(
    theme?.colors?.pageBg || theme?.backgroundColor || "#f8fafc",
    "#f8fafc",
  );
  const textColor = sanitizeCssColor(
    theme?.colors?.textColor || theme?.textColor || "#0f172a",
    "#0f172a",
  );
  const cardBgColor = sanitizeCssColor(
    theme?.colors?.cardBg || theme?.cardBg || "#ffffff",
    "#ffffff",
  );

  // Анализируем тему: Темная или Светлая
  const isDarkTheme = isDark(bgColor);

  // 🚀 ГЕНЕРАЦИЯ "УМНОГО СТЕКЛА" В ЗАВИСИМОСТИ ОТ ТЕМЫ
  const glassBg = isDarkTheme
    ? `color-mix(in srgb, ${cardBgColor} 65%, rgba(0,0,0,0.3))` // Чуть затемняем темное стекло
    : `color-mix(in srgb, ${cardBgColor} 75%, transparent)`;

  const glassBorder = isDarkTheme
    ? `color-mix(in srgb, #ffffff 12%, transparent)` // В темной теме рамки всегда белые полупрозрачные
    : `color-mix(in srgb, ${textColor} 8%, transparent)`;

  const glassHighlight = isDarkTheme
    ? `color-mix(in srgb, #ffffff 6%, transparent)` // Слабый блик в темной теме
    : `color-mix(in srgb, #ffffff 70%, transparent)`; // Яркий белый блик в светлой

  const glassShadow = isDarkTheme
    ? `0 16px 40px -8px rgba(0,0,0,0.6)` // Глубокая черная тень
    : `0 12px 40px -12px color-mix(in srgb, ${textColor} 12%, transparent)`; // Мягкая цветная тень

  const themeVars = {
    "--project-primary": primaryColor,
    "--project-secondary": secondaryColor,
    "--project-bg": bgColor,
    "--project-text": textColor,
    "--project-card-bg": cardBgColor,
    "--accent2": primaryColor,
    "--accent3": secondaryColor,

    // Глобальные переменные стекла
    "--glass-bg": glassBg,
    "--glass-border": glassBorder,
    "--glass-highlight": glassHighlight,
    "--glass-shadow": glassShadow,
    "--glass-blur": "24px",
  };

  const themeStyles = {
    ...themeVars,
    backgroundColor: "var(--project-bg)",
    color: "var(--project-text)",
  } as React.CSSProperties;

  // ⚠️ КРИТИЧНО: те же переменные дублируем в :root через <style>.
  // Модалки (components/Modal.tsx) рендерятся через createPortal(..., document.body),
  // то есть их DOM-узел физически лежит ВНЕ этого <div style={themeStyles}>.
  // CSS-переменные наследуются по реальному DOM-дереву, а не по дереву React,
  // поэтому без этого блока портализированный контент (модалки, тултипы и т.п.)
  // всегда падал на дефолты из globals.css, игнорируя тему проекта.
  // :root — общий предок и для <body>, и для всего, что в него портализировано,
  // так что через :root тема долетает куда угодно.
  const rootCssText = Object.entries(themeVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");

  return (
    <>
      <style
        id="project-theme-vars"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: `:root { ${rootCssText} }` }}
      />
      <div
        style={themeStyles}
        className="min-h-screen w-full transition-colors duration-500 project-layout-wrapper"
      >
        {children}
      </div>
    </>
  );
}