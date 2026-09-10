import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "skilLS — онлайн-платформа подготовки к олимпиаде Hippo и экзаменам Gatehouse Awards",
  description:
    "skilLS — интерактивная онлайн-платформа подготовки к международной олимпиаде Hippo и экзаменам Gatehouse Awards по английскому языку.",
};

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

