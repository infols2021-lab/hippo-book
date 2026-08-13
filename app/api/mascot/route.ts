// app/api/mascot/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  equipMascotItem,
  getMascotSettings,
  getUserInventory,
} from "@/lib/rewards/data";
import type { RewardType } from "@/lib/rewards/types";
import { isValidUUID } from "@/lib/api/validate";

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

    const adminSupabase = getSupabaseAdminClient();

    const [mascot, inventory] = await Promise.all([
      getMascotSettings(adminSupabase, user.id),
      getUserInventory(adminSupabase, user.id),
    ]);

    return NextResponse.json({
      ok: true,
      mascot,
      inventory: Array.isArray(inventory) ? inventory : [],
    });
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

    const adminSupabase = getSupabaseAdminClient();

    // Защита: проверяем, присутствует ли предмет в реальном инвентаре пользователя
    if (rewardId) {
      const normalizedRewardId = String(rewardId).trim();
      if (!isValidUUID(normalizedRewardId)) {
        return NextResponse.json(
          { error: "Некорректный идентификатор награды" },
          { status: 400 }
        );
      }

      const { data: invItem } = await adminSupabase
        .from("user_inventory")
        .select("id")
        .eq("user_id", user.id)
        .eq("reward_id", normalizedRewardId)
        .maybeSingle();

      if (!invItem) {
        return NextResponse.json(
          { error: "Данный предмет отсутствует в вашем инвентаре" },
          { status: 400 }
        );
      }
    }

    const result = await equipMascotItem(
      adminSupabase,
      user.id,
      category as RewardType,
      rewardId ? String(rewardId).trim() : null
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const updatedMascot = await getMascotSettings(adminSupabase, user.id);

    return NextResponse.json({
      ok: true,
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