// app/(app)/gatehouse/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function GatehousePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();

  // Если пользователь не авторизован, отправляем на страницу входа
  if (!auth.user) {
    redirect("/login");
  }

  // Если авторизован, сразу перекидываем в дашборд экзаменов (профиль)
  redirect("/gatehouse/profile");
}