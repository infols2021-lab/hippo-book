import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Корневой адрес: авторизованного пользователя перекидываем в портал,
// остальных — на вход. Так корень не «проглатывает» редиректы после
// подтверждения email (например, /email-confirmed).
export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/portal" : "/login");
}

