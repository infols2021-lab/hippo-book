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
  const primaryColor = theme?.colors?.primary || theme?.primaryColor || project.theme_color || "#0ea5e9";
  const secondaryColor = theme?.colors?.secondary || theme?.secondaryColor || "#38bdf8";
  const bgColor = theme?.colors?.pageBg || theme?.backgroundColor || "#f8fafc";
  const textColor = theme?.colors?.textColor || theme?.textColor || "#0f172a";
  const cardBgColor = theme?.colors?.cardBg || theme?.cardBg || "#ffffff";

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

  const themeStyles = {
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

    backgroundColor: "var(--project-bg)",
    color: "var(--project-text)",
  } as React.CSSProperties;

  return (
    <div 
      style={themeStyles} 
      className="min-h-screen w-full transition-colors duration-500 project-layout-wrapper"
    >
      {children}
    </div>
  );
}