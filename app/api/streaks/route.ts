// app/api/streaks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { claimStreakReward, getStreakPath } from "@/lib/rewards/data";

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

    const { stats, path } = await getStreakPath(supabase, user.id);

    return NextResponse.json({
      stats,
      currentStreak: stats.currentStreak,
      path,
    });
  } catch (error: any) {
    console.error("Ошибка при получении дорожки серии:", error);
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