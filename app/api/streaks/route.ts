// app/api/streaks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { claimStreakReward, getStreakPath } from "@/lib/rewards/data";

function calculateTierCode(streak: number): string {
  if (streak >= 100) return "legendary";
  if (streak >= 50) return "diamond";
  if (streak >= 30) return "platinum";
  if (streak >= 14) return "gold";
  if (streak >= 7) return "silver";
  if (streak >= 3) return "bronze";
  return "none";
}

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

    // 1. Напрямую запрашиваем ground-truth из user_streaks через adminSupabase
    const { data: userStreakRow } = await adminSupabase
      .from("user_streaks")
      .select("current_streak, longest_streak, last_completed_date")
      .eq("user_id", user.id)
      .maybeSingle();

    // 2. Проверяем, было ли сегодня выполнение
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: todayDay } = await adminSupabase
      .from("user_streak_days")
      .select("activity_date")
      .eq("user_id", user.id)
      .eq("activity_date", todayStr)
      .maybeSingle();

    const isCompletedToday = Boolean(
      todayDay || userStreakRow?.last_completed_date === todayStr
    );

    // 3. Пытаемся забрать дорожку наград
    let path: any[] = [];
    let pathStats: any = null;

    try {
      const streakPathRes = await getStreakPath(supabase, user.id);
      path = streakPathRes?.path || [];
      pathStats = streakPathRes?.stats || null;
    } catch (e) {
      console.warn("Фоновое предупреждение при получении дорожки наград:", e);
    }

    // 4. Формируем гарантированно верные финальные показатели
    const currentStreak = Number(
      userStreakRow?.current_streak ?? pathStats?.currentStreak ?? 0
    );
    const longestStreak = Number(
      userStreakRow?.longest_streak ?? pathStats?.maxStreak ?? 0
    );
    const completedToday = isCompletedToday || Boolean(pathStats?.completedToday);

    const stats = {
      currentStreak,
      maxStreak: longestStreak,
      longestStreak,
      completedToday,
      lastCompletedAt: userStreakRow?.last_completed_date || pathStats?.lastCompletedAt || null,
    };

    // 5. Определяем надетый титул и аватар
    let equippedTitleLabel: string | null = null;
    let equippedAvatarUrl: string | null = null;

    const { data: mascot } = await adminSupabase
      .from("mascot_settings")
      .select("equipped_title_id, equipped_base_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (mascot?.equipped_title_id) {
      const { data: rewardTitle } = await adminSupabase
        .from("rewards")
        .select("title")
        .eq("id", mascot.equipped_title_id)
        .maybeSingle();

      if (rewardTitle?.title) {
        equippedTitleLabel = rewardTitle.title;
      }
    }

    if (!equippedTitleLabel) {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("selected_streak_title_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.selected_streak_title_code) {
        const { data: titleCatalog } = await adminSupabase
          .from("streak_title_catalog")
          .select("label")
          .eq("code", profile.selected_streak_title_code)
          .maybeSingle();

        if (titleCatalog?.label) {
          equippedTitleLabel = titleCatalog.label;
        }
      }
    }

    if (mascot?.equipped_base_id) {
      const { data: rewardBase } = await adminSupabase
        .from("rewards")
        .select("asset_url")
        .eq("id", mascot.equipped_base_id)
        .maybeSingle();

      if (rewardBase?.asset_url) {
        equippedAvatarUrl = rewardBase.asset_url;
      }
    }

    return NextResponse.json({
      ok: true,
      success: true,
      streak: {
        currentStreak,
        longestStreak,
        maxStreak: longestStreak,
        doneToday: completedToday,
        tierCode: calculateTierCode(currentStreak),
      },
      equippedTitle: equippedTitleLabel ? { label: equippedTitleLabel } : null,
      equippedAvatarUrl,
      stats,
      currentStreak,
      longestStreak,
      maxStreak: longestStreak,
      path,
    });
  } catch (error: any) {
    console.error("Ошибка при получении данных серии:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Невалидный JSON в теле запроса" },
        { status: 400 }
      );
    }

    const dayNumber = Number(body.dayNumber);

    if (!Number.isInteger(dayNumber) || dayNumber <= 0) {
      return NextResponse.json(
        { error: "Некорректный номер дня серии" },
        { status: 400 }
      );
    }

    const result = await claimStreakReward(supabase, user.id, dayNumber);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      success: true,
      reward: result.reward,
    });
  } catch (error: any) {
    console.error("Ошибка при получении награды за серию:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}