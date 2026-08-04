// app/api/streaks/leaderboard/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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

    // 1. Пробуем вызвать RPC функцию лидерборда
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      "get_streak_leaderboard",
      { _top: 20, _above: 5 }
    );

    if (!rpcError && rpcData) {
      const list = rpcData.leaderboard || rpcData.top || rpcData || [];
      return NextResponse.json({
        ok: true,
        success: true,
        leaderboard: Array.isArray(list) ? list : [],
      });
    }

    // 2. Резервный прямой запрос через Service RoleClient
    const { data: streaks, error: streaksError } = await adminSupabase
      .from("user_streaks")
      .select(`
        user_id,
        current_streak,
        longest_streak,
        last_completed_date,
        profiles:user_id (
          full_name,
          selected_streak_icon_code,
          selected_streak_title_code
        )
      `)
      .or("longest_streak.gt.0,current_streak.gt.0")
      .order("longest_streak", { ascending: false })
      .order("current_streak", { ascending: false })
      .limit(20);

    if (streaksError) {
      return NextResponse.json(
        { error: streaksError.message },
        { status: 400 }
      );
    }

    const formattedList = (streaks || []).map((item: any) => ({
      user_id: item.user_id,
      full_name: item.profiles?.full_name || "Ученик",
      current_streak: Number(item.current_streak || 0),
      longest_streak: Number(item.longest_streak || 0),
      last_completed_date: item.last_completed_date,
      selected_streak_icon_code: item.profiles?.selected_streak_icon_code || null,
      selected_streak_title_code: item.profiles?.selected_streak_title_code || null,
    }));

    return NextResponse.json({
      ok: true,
      success: true,
      leaderboard: formattedList,
    });
  } catch (error: any) {
    console.error("Ошибка при получении лидерборда:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}