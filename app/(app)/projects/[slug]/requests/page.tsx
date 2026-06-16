import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import RequestsClient from "./RequestsClient";

export const revalidate = 0; // Всегда свежие данные

export default async function ProjectRequestsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  // 1. Проверяем юзера
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userProfile } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  // 2. Получаем текущий проект
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_active) notFound();

  // 3. Собираем реальные табы, уровни и историю заявок этого юзера
  const [tabsRes, levelsRes, requestsRes] = await Promise.all([
    supabase.from("project_tabs").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("project_levels").select("*").eq("project_id", project.id).eq("is_active", true).order("order_index"),
    supabase.from("purchase_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
  ]);

  // Фильтруем заявки (оставляем только те, что относятся к этому проекту, либо легаси без проекта)
  const allRequests = requestsRes.data || [];
  const projectRequests = allRequests.filter(r => r.project_id === project.id || !r.project_id);

  return (
    <RequestsClient
      project={project}
      levels={levelsRes.data || []}
      tabs={tabsRes.data || []}
      userId={user.id}
      userEmail={user.email || userProfile?.email || ""}
      userFullName={userProfile?.full_name || "Ученик"}
      initialRequests={projectRequests}
    />
  );
}