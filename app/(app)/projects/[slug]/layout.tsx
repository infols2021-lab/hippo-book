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

  // Базовые цвета
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
  
  // ЖБ Фон для инпутов, чтобы они не сливались в грязь
  const inputBgColor = isDarkTheme ? "rgba(0, 0, 0, 0.25)" : "#ffffff";

  // 🚀 ГЕНЕРАЦИЯ "УМНОГО СТЕКЛА"
  const glassBg = isDarkTheme
    ? `color-mix(in srgb, ${cardBgColor} 65%, rgba(0,0,0,0.3))`
    : `color-mix(in srgb, ${cardBgColor} 75%, transparent)`;

  const glassBorder = isDarkTheme
    ? `color-mix(in srgb, #ffffff 12%, transparent)`
    : `color-mix(in srgb, ${textColor} 8%, transparent)`;

  const glassHighlight = isDarkTheme
    ? `color-mix(in srgb, #ffffff 6%, transparent)`
    : `color-mix(in srgb, #ffffff 70%, transparent)`;

  const glassShadow = isDarkTheme
    ? `0 16px 40px -8px rgba(0,0,0,0.6)`
    : `0 12px 40px -12px color-mix(in srgb, ${textColor} 12%, transparent)`;

  const themeVars = {
    "--project-primary": primaryColor,
    "--project-secondary": secondaryColor,
    "--project-bg": bgColor,
    "--project-text": textColor,
    "--project-card-bg": cardBgColor,
    "--project-input-bg": inputBgColor, // Добавили переменную инпутов
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