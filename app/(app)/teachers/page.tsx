import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TeachersClient from "./TeachersClient";

export const revalidate = 0;

export default async function TeachersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth?.user) redirect("/login");

  // 1. Проверяем роль
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", auth.user.id)
    .single();

  if (profile?.role !== "teacher" && profile?.is_admin !== true) {
    redirect("/portal"); // Обычным юзерам тут делать нечего
  }

  // 2. Достаем список привязанных учеников
  // Используем foreign key, чтобы сразу вытащить данные профиля ученика
  const { data: referrals } = await supabase
    .from("user_referrals")
    .select(`
      id,
      created_at,
      status,
      student:profiles!user_referrals_referred_id_fkey (
        id,
        full_name,
        email,
        progress_visible
      )
    `)
    .eq("referrer_id", auth.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Форматируем данные для клиента
  const students = referrals?.map((r: any) => ({
    connectionId: r.id,
    joinedAt: r.created_at,
    id: r.student?.id,
    fullName: r.student?.full_name,
    email: r.student?.email,
    progressVisible: r.student?.progress_visible,
  })) || [];

  return <TeachersClient students={students} />;
}