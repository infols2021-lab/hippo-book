// app/api/mascot/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  equipMascotItem,
  getMascotSettings,
  getUserInventory,
} from "@/lib/rewards/data";
import type { RewardType } from "@/lib/rewards/types";

const VALID_CATEGORIES: RewardType[] = [
  "base",
  "hat",
  "aura",
  "emotion",
  "title",
];

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

    const [mascot, inventory] = await Promise.all([
      getMascotSettings(supabase, user.id),
      getUserInventory(supabase, user.id),
    ]);

    return NextResponse.json({ mascot, inventory });
  } catch (error: any) {
    console.error("Ошибка при получении данных маскота:", error);
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

    const { category, rewardId } = body;

    if (!category || !VALID_CATEGORIES.includes(category as RewardType)) {
      return NextResponse.json(
        { error: "Указана недопустимая категория элемента" },
        { status: 400 }
      );
    }

    const result = await equipMascotItem(
      supabase,
      user.id,
      category as RewardType,
      rewardId ? String(rewardId) : null
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updatedMascot = await getMascotSettings(supabase, user.id);

    return NextResponse.json({
      success: true,
      mascot: updatedMascot,
    });
  } catch (error: any) {
    console.error("Ошибка при обновлении экипировки маскота:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}