// app/api/streaks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyStreakExpiry,
  claimStreakReward,
  getStreakPath,
} from "@/lib/rewards/data";

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

    // 1. Запрашиваем данные из user_streaks и profiles
    const [{ data: userStreakRow }, { data: profileRow }] = await Promise.all([
      adminSupabase
        .from("user_streaks")
        .select("current_streak, longest_streak, last_completed_date")
        .eq("user_id", user.id)
        .maybeSingle(),
      adminSupabase
        .from("profiles")
        .select("selected_streak_title_code")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    // 2. Проверяем выполнение за сегодня
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

    // 3. Запрашиваем дорожку наград
    let path: any[] = [];
    let pathStats: any = null;

    try {
      const streakPathRes = await getStreakPath(supabase, user.id);
      path = streakPathRes?.path || [];
      pathStats = streakPathRes?.stats || null;
    } catch (e) {
      console.warn("Фоновое предупреждение при получении дорожки наград:", e);
    }

    const rawCurrentStreak = Number(
      userStreakRow?.current_streak ?? pathStats?.currentStreak ?? 0
    );
    const longestStreak = Number(
      userStreakRow?.longest_streak ?? pathStats?.maxStreak ?? rawCurrentStreak
    );
    const completedToday = isCompletedToday || Boolean(pathStats?.completedToday);

    // Если серия протухла — сбрасываем её в БД и возвращаем 0.
    const lastCompletedAt =
      userStreakRow?.last_completed_date || pathStats?.lastCompletedAt || null;
    const currentStreak = applyStreakExpiry(rawCurrentStreak, lastCompletedAt);
    if (currentStreak !== rawCurrentStreak) {
      await adminSupabase
        .from("user_streaks")
        .update({ current_streak: 0 })
        .eq("user_id", user.id);
    }

    const stats = {
      currentStreak,
      maxStreak: longestStreak,
      longestStreak,
      completedToday,
      lastCompletedAt,
    };


    // 4. Экипировка маскота / титулы
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

    if (!equippedTitleLabel && profileRow?.selected_streak_title_code) {
      const { data: titleCatalog } = await adminSupabase
        .from("streak_title_catalog")
        .select("label")
        .eq("code", profileRow.selected_streak_title_code)
        .maybeSingle();

      if (titleCatalog?.label) {
        equippedTitleLabel = titleCatalog.label;
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
        tierCode: calculateTierCode(longestStreak),
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