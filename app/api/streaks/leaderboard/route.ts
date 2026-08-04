// app/api/streaks/leaderboard/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

    const adminSupabase = getSupabaseAdminClient();

    // Раньше здесь был отдельный (и неверный) запрос к таблице user_streaks,
    // которая не синхронизирована с profiles — из-за этого лидерборд всегда
    // был пустым. Теперь используем ту же функцию, что и остальная система
    // наград (`lib/rewards/data.ts`), которая читает из `profiles` —
    // единственного источника правды по сериям.
    const leaderboard = await getStreakLeaderboard(adminSupabase, user.id);

    return NextResponse.json({
      ok: true,
      success: true,
      leaderboard,
    });
  } catch (error: any) {
    console.error("Ошибка при получении лидерборда:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}