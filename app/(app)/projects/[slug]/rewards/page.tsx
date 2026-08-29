/* app/(app)/projects/[slug]/rewards/page.tsx */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import RewardsPage from "./RewardsPage";

// Отключаем кэш, чтобы данные наград (инвентарь, серии) были всегда свежими
export const revalidate = 0;

export default async function ProjectRewardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;
  const { tab } = await searchParams;

  // 1. Проверяем авторизацию
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Проверяем существование активного направления
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, features, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (!project || project.is_active === false) {
    notFound();
  }

  const projectName = project.name || "Направление";
  const markText = project.slug.slice(0, 2).toUpperCase();

  return <RewardsPage projectSlug={slug} projectName={projectName} markText={markText} initialTab={tab} />;
}
