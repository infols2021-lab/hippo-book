import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data: project } = await supabase
    .from("projects")
    .select("id, is_active, theme, theme_color")
    .eq("slug", slug)
    .single();

  if (!project || project.is_active === false) {
    notFound();
  }

  const theme = project.theme || {};

  const primaryColor =
    theme?.colors?.primary ||
    theme?.primaryColor ||
    project.theme_color ||
    "#0ea5e9";

  const secondaryColor =
    theme?.colors?.secondary ||
    theme?.secondaryColor ||
    "#38bdf8";

  const bgColor =
    theme?.colors?.pageBg ||
    theme?.backgroundColor ||
    "#f8fafc";

  const textColor =
    theme?.colors?.textColor ||
    theme?.textColor ||
    "#0f172a";

  const cardBgColor =
    theme?.colors?.cardBg ||
    theme?.cardBg ||
    "#ffffff";

  const themeStyles = {
    "--project-primary": primaryColor,
    "--project-secondary": secondaryColor,
    "--project-bg": bgColor,
    "--project-text": textColor,
    "--project-card-bg": cardBgColor,
    "--accent2": primaryColor,
    "--accent3": secondaryColor,
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