import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import "../materials/materials.css";

export const revalidate = 0;

function isDark(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return false;
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 128; 
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

  if (!project || project.is_active === false) notFound();

  const theme = project.theme || {};

  const primaryColor = sanitizeCssColor(theme?.colors?.primary || theme?.primaryColor || project.theme_color || "#0ea5e9", "#0ea5e9");
  const secondaryColor = sanitizeCssColor(theme?.colors?.secondary || theme?.secondaryColor || "#38bdf8", "#38bdf8");
  const bgColor = sanitizeCssColor(theme?.colors?.pageBg || theme?.backgroundColor || "#f8fafc", "#f8fafc");
  const textColor = sanitizeCssColor(theme?.colors?.textColor || theme?.textColor || "#0f172a", "#0f172a");
  const cardBgColor = sanitizeCssColor(theme?.colors?.cardBg || theme?.cardBg || "#ffffff", "#ffffff");

  const isDarkTheme = isDark(bgColor);
  
  // ИДЕАЛЬНЫЕ ИНПУТЫ: Светло-серые на белом фоне, полупрозрачно-черные на тёмном.
  const inputBgColor = isDarkTheme ? "rgba(0, 0, 0, 0.3)" : "#f8fafc";
  const inputTextColor = textColor;
  const inputBorderColor = isDarkTheme ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0";

  // Плотные рамки и тени
  const glassBorder = isDarkTheme ? `rgba(255, 255, 255, 0.08)` : `rgba(15, 23, 42, 0.08)`;
  const glassShadow = isDarkTheme ? `0 16px 40px -8px rgba(0,0,0,0.6)` : `0 12px 30px -12px rgba(15, 23, 42, 0.15)`;

  const themeVars = {
    "--project-primary": primaryColor,
    "--project-secondary": secondaryColor,
    "--project-bg": bgColor,
    "--project-text": textColor,
    "--project-card-bg": cardBgColor,
    "--project-input-bg": inputBgColor, 
    "--project-input-text": inputTextColor,
    "--project-input-border": inputBorderColor,
    "--glass-border": glassBorder,
    "--glass-shadow": glassShadow,
  };

  const rootCssText = Object.entries(themeVars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ");

  return (
    <>
      <style id="project-theme-vars" dangerouslySetInnerHTML={{ __html: `:root { ${rootCssText} }` }} />
      <div 
        style={themeVars as React.CSSProperties} 
        // Добавлено отступа снизу на мобилках, чтобы контент не перекрывался плавающим меню
        // (реальная величина с учётом safe-area задана в CSS ниже — .project-layout-wrapper)
        className="min-h-screen w-full transition-colors duration-500 project-layout-wrapper pb-0 md:pb-0 relative flex flex-col"
      >
        {children}
        
        {/* Интегрирована плавающая нижняя панель навигации */}
        <BottomNav slug={slug} />
      </div>
    </>
  );
}