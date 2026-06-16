/* app/(app)/portal/page.tsx */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PortalClient from "./PortalClient";

export default async function PortalPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth?.user) redirect("/login");

  const user = auth.user;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const isAdmin = Boolean(profile?.is_admin);
  
  // Умный парсинг ФИО: берем полное имя, либо склеиваем имя и фамилию из метаданных
  let userName = profile?.full_name || user.user_metadata?.full_name || "";
  if (!userName && (user.user_metadata?.first_name || user.user_metadata?.last_name)) {
    userName = `${user.user_metadata?.first_name || ""} ${user.user_metadata?.last_name || ""}`.trim();
  }
  const userEmail = user.email || "";

  // Берем только АКТИВНЫЕ ветки
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, description, theme, is_active")
    .eq("is_active", true) 
    .order("order_index", { ascending: true });

  return <PortalClient userName={userName || "Ученик"} userEmail={userEmail} isAdmin={isAdmin} projects={projects || []} />;
}