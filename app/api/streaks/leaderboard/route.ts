// app/api/streaks/leaderboard/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStreakLeaderboard } from "@/lib/rewards/data";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Необходима авторизация" },
        { status: 401 }
      );
    }

    const leaderboard = await getStreakLeaderboard(supabase, user.id);

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    console.error("Ошибка при получении лидерборда:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}