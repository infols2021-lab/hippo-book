// app/api/streaks/leaderboard/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyStreakExpiry, getStreakLeaderboard } from "@/lib/rewards/data";

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
    let leaderboard: any[] = [];

    // 1. Пробуем получить лидерборд через стандартную логику rewards/data
    try {
      leaderboard = await getStreakLeaderboard(adminSupabase, user.id);
    } catch (e) {
      console.warn("Ошибка при получении лидерборда через RPC:", e);
    }

    // 2. Фолбэк: если RPC вернул пустоту или упал, запрашиваем напрямую из user_streaks
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
      const { data: rawRows } = await adminSupabase
        .from("user_streaks")
        .select("user_id, current_streak, longest_streak, last_completed_date")
        .gt("longest_streak", 0)
        .order("longest_streak", { ascending: false })
        .order("current_streak", { ascending: false })
        .limit(20);

      if (Array.isArray(rawRows) && rawRows.length > 0) {
        leaderboard = rawRows.map((row, idx) => ({
          rank: idx + 1,
          user_id: row.user_id,
          current_streak: applyStreakExpiry(
            row.current_streak || 0,
            row.last_completed_date
          ),
          max_streak: row.longest_streak || 0,
          longest_streak: row.longest_streak || 0,
          is_current_user: row.user_id === user.id,
        }));
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      leaderboard: leaderboard || [],
    });
  } catch (error: any) {
    console.error("Ошибка при получении лидерборда:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}