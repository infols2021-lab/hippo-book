/* app/(app)/projects/[slug]/profile/page.tsx */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";
import { ProfileTourTrigger } from "@/components/tour/ProfileTourTrigger";

// Отключаем кэш, чтобы настройки профиля и темы всегда были свежими
export const revalidate = 0;

export default async function ProjectProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Проверяем авторизацию
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Получаем ядро текущей ветки (проекта)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, features, is_active, theme, theme_color")
    .eq("slug", slug)
    .maybeSingle();

  // Защита от несуществующих или скрытых веток
  if (!project || project.is_active === false) {
    notFound();
  }

  // 3. НОВОЕ: Получаем ВСЕ активные проекты для меню-переключателя
  const { data: activeProjects } = await supabase
    .from("projects")
    .select("id, name, slug, theme, theme_color")
    .eq("is_active", true)
    .order("order_index", { ascending: true });

  // 4. Получаем данные профиля пользователя
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("full_name, contact_phone, region, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const initialProfile = {
    full_name: userProfile?.full_name || "",
    contact_phone: userProfile?.contact_phone || "",
    region: userProfile?.region || "",
    is_admin: Boolean(userProfile?.is_admin),
  };

  // Directions where the user already has granted materials (badge in switcher)
  const { data: profileAccessRows } = await supabase.from("material_access").select("material_id").eq("user_id", user.id);
  const { data: profileGrantRows } = await supabase.from("purchase_request_grants").select("material_id").eq("user_id", user.id);
  const grantedMaterialIds = Array.from(
    new Set<string>(
      [
        ...(profileAccessRows || []).map((a) => a.material_id),
        ...(profileGrantRows || []).map((g) => g.material_id),
      ].filter(Boolean)
    )
  );
  let grantedProjectSlugs: string[] = [];
  if (grantedMaterialIds.length > 0) {
    const { data: gMats } = await supabase.from("materials").select("project_tab_id").in("id", grantedMaterialIds);
    const gTabIds = Array.from(new Set<string>((gMats || []).map((m) => m.project_tab_id).filter(Boolean)));
    const { data: gTabs } = gTabIds.length
      ? await supabase.from("project_tabs").select("project_id").in("id", gTabIds)
      : { data: [] }
    const gProjIds = Array.from(new Set<string>((gTabs || []).map((t) => t.project_id).filter(Boolean)));
    const { data: gProj } = gProjIds.length
      ? await supabase.from("projects").select("slug").in("id", gProjIds)
      : { data: [] }
    grantedProjectSlugs = (gProj || []).map((p) => p.slug);
  }

  // 5. Флаги геймификации
  const rawFeatures = project.features || {};
  const features = {
    streaks: true,
    titles: true,
    leaderboard: Boolean(rawFeatures.leaderboard ?? true),
  };

  // Картинка фона из темы проекта
  const backgroundUrl =
    project.theme?.backgroundUrl || project.theme?.bgImage || null;

  // 6. Передаём всё в клиентский компонент профиля
  return (
    <>
      <ProfileTourTrigger />
      <ProfileClient
        projectName={project.name}
        projectSlug={project.slug}
        availableProjects={activeProjects || []}
        grantedProjectSlugs={grantedProjectSlugs}
        features={features}
        userId={user.id}
        userEmail={user.email || ""}
        initialProfile={initialProfile}
        backgroundUrl={backgroundUrl}
      />
    </>
  );
}