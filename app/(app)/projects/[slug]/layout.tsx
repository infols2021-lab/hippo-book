import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Отключаем кэширование, чтобы статусы веток проверялись мгновенно
export const revalidate = 0;

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Получаем конфиг ветки вместе с цветом темы
  const { data: project } = await supabase
    .from("projects")
    .select("id, is_active, theme, theme_color")
    .eq("slug", slug)
    .single();

  if (!project || project.is_active === false) {
    notFound();
  }

  // 2. Извлекаем цвета с приоритетом: theme.colors.primary -> theme.primaryColor -> theme_color -> дефолт
  const theme = project.theme || {};
  const primaryColor =
    theme?.colors?.primary ||
    theme?.primaryColor ||
    project.theme_color ||
    "#3b82f6";

  const secondaryColor =
    theme?.colors?.secondary ||
    theme?.secondaryColor ||
    "#1d4ed8";

  const bgColor =
    theme?.colors?.pageBg ||
    theme?.backgroundColor ||
    "#f8fafc";

  const textColor =
    theme?.colors?.textColor ||
    theme?.textColor ||
    "#0f172a";

  const mutedColor =
    theme?.colors?.muted ||
    theme?.mutedColor ||
    "#64748b";

  const cardBgColor =
    theme?.colors?.cardBg ||
    theme?.cardBg ||
    "#ffffff";

  const borderColor =
    theme?.colors?.border ||
    theme?.borderColor ||
    "rgba(15, 23, 42, 0.12)";

  const glowColor =
    theme?.colors?.glow ||
    theme?.glowColor ||
    "rgba(59, 130, 246, 0.25)";

  // Формируем глобальные CSS-переменные для всего документа
  const cssVars = `
    :root {
      --project-primary: ${primaryColor};
      --project-secondary: ${secondaryColor};
      --project-bg: ${bgColor};
      --project-text: ${textColor};
      --project-muted: ${mutedColor};
      --project-card-bg: ${cardBgColor};
      --project-border: ${borderColor};
      --project-glow: ${glowColor};
      --accent2: ${primaryColor};
      --accent2-soft: ${primaryColor}22;
    }
    body {
      background-color: ${bgColor};
      color: ${textColor};
    }
  `;

  return (
    <>
      {/* Глобальные стили для всей страницы */}
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />

      <div
        style={
          {
            // Дополнительные переменные для локального использования (если нужно)
            backgroundColor: bgColor,
          } as React.CSSProperties
        }
        className="min-h-screen w-full transition-colors duration-500"
      >
        {children}
      </div>
    </>
  );
}