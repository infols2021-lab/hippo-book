/* app/(app)/projects/[slug]/profile/page.tsx */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

// Отключаем кэш, чтобы настройки фичей и профиль всегда были свежими
export const revalidate = 0;

export default async function ProjectProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Проверяем авторизацию
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Получаем ядро ветки (проекта)
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, features, is_active, theme, theme_color")
    .eq("slug", slug)
    .single();

  // Защита от несуществующих или скрытых веток
  if (!project || project.is_active === false) {
    notFound();
  }

  // 3. Получаем данные профиля пользователя (имя, телефон, регион, роль)
  // Используем таблицу profiles (не users)
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

  // 4. Формируем флаги геймификации (с поддержкой обратной совместимости легаси-ключей)
  const rawFeatures = project.features || {};
  const features = {
    streaks: Boolean(rawFeatures.streaks || rawFeatures.hasStreaks),
    titles: Boolean(rawFeatures.titles || rawFeatures.hasTitles),
    leaderboard: Boolean(rawFeatures.leaderboard || rawFeatures.hasLeaderboard),
  };

  // Достаем картинку фона из темы (если она была задана в админке)
  const backgroundUrl = project.theme?.backgroundUrl || project.theme?.bgImage || null;

  // 5. Передаём всё в умный клиентский компонент
  return (
    <ProfileClient
      projectName={project.name}
      projectSlug={project.slug}
      features={features}
      userId={user.id}
      userEmail={user.email || ""}
      initialProfile={initialProfile}
      backgroundUrl={backgroundUrl}
    />
  );
}