import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PortalClient from "./PortalClient";

export default async function PortalPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth?.user) {
    redirect("/login");
  }

  const user = auth.user;

  // 1. Получаем профиль юзера (чтобы знать имя и админ ли он)
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin" || profile?.role === "teacher";
  const userName = profile?.full_name || user.user_metadata?.full_name || "";
  const userEmail = user.email || "";

  // 2. ВЫГРУЖАЕМ ПРОЕКТЫ ИЗ БАЗЫ! (То, чего не хватало)
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description, theme, is_available")
    .eq("is_available", true) // Берем только активные ветки
    .order("created_at", { ascending: true });

  return (
    <PortalClient
      userName={userName}
      userEmail={userEmail}
      isAdmin={isAdmin}
      projects={projects || []} // Передаем проекты в клиентский компонент!
    />
  );
}