// app/api/admin/streaks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

async function verifyAdmin() {
  const userClient = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return { user: null, error: "Необходима авторизация", adminSupabase: null };
  }

  const adminSupabase = getSupabaseAdminClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;
  if (!isAdmin) {
    return { user: null, error: "Доступ запрещен. Требуются права администратора", adminSupabase: null };
  }

  return { user, error: null, adminSupabase };
}

export async function GET() {
  try {
    const { error: adminErr, adminSupabase } = await verifyAdmin();
    if (adminErr || !adminSupabase) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const { data, error } = await adminSupabase
      .from("streak_config")
      .select("*, reward:rewards(*)")
      .order("day_number", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ streakConfig: data || [] });
  } catch (error: any) {
    console.error("Ошибка при получении конфигурации стриков:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { error: adminErr, adminSupabase } = await verifyAdmin();
    if (adminErr || !adminSupabase) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
    }

    const dayNumber = Number(body.dayNumber);
    const rewardId = String(body.rewardId || "").trim();

    if (!Number.isInteger(dayNumber) || dayNumber <= 0) {
      return NextResponse.json(
        { error: "Укажите корректный номер дня серии" },
        { status: 400 }
      );
    }

    if (!rewardId) {
      return NextResponse.json(
        { error: "Выберите награду из каталога" },
        { status: 400 }
      );
    }

    // 1. Узнаем, какая награда была привязана ранее
    const { data: oldConfig } = await adminSupabase
      .from("streak_config")
      .select("reward_id")
      .eq("day_number", dayNumber)
      .maybeSingle();

    const oldRewardId = oldConfig?.reward_id;

    // 2. Обновляем привязку дня
    const { data, error } = await adminSupabase
      .from("streak_config")
      .upsert(
        { day_number: dayNumber, reward_id: rewardId },
        { onConflict: "day_number" }
      )
      .select("*, reward:rewards(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Если привязка изменилась, изымаем старую награду из стриков
    if (oldRewardId && oldRewardId !== rewardId) {
      await adminSupabase
        .from("user_inventory")
        .delete()
        .eq("reward_id", oldRewardId)
        .eq("source", "streak");
    }

    return NextResponse.json({ success: true, item: data });
  } catch (error: any) {
    console.error("Ошибка при привязке награды к дню серии:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { error: adminErr, adminSupabase } = await verifyAdmin();
    if (adminErr || !adminSupabase) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dayNumber = Number(searchParams.get("dayNumber"));

    if (!Number.isInteger(dayNumber) || dayNumber <= 0) {
      return NextResponse.json(
        { error: "Укажите корректный номер дня (dayNumber)" },
        { status: 400 }
      );
    }

    // 1. Получаем удаляемую награду
    const { data: oldConfig } = await adminSupabase
      .from("streak_config")
      .select("reward_id")
      .eq("day_number", dayNumber)
      .maybeSingle();

    const rewardIdToDelete = oldConfig?.reward_id;

    // 2. Удаляем конфигурацию дня
    const { error } = await adminSupabase
      .from("streak_config")
      .delete()
      .eq("day_number", dayNumber);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Автоматически чистим инвентарь от удалённой награды стрика
    if (rewardIdToDelete) {
      await adminSupabase
        .from("user_inventory")
        .delete()
        .eq("reward_id", rewardIdToDelete)
        .eq("source", "streak");

      // Скидываем надевание этой награды, если она на ком-то надета
      await Promise.all([
        adminSupabase.from("mascot_settings").update({ equipped_hat_id: null }).eq("equipped_hat_id", rewardIdToDelete),
        adminSupabase.from("mascot_settings").update({ equipped_aura_id: null }).eq("equipped_aura_id", rewardIdToDelete),
        adminSupabase.from("mascot_settings").update({ equipped_emotion_id: null }).eq("equipped_emotion_id", rewardIdToDelete),
        adminSupabase.from("mascot_settings").update({ equipped_base_id: null }).eq("equipped_base_id", rewardIdToDelete),
        adminSupabase.from("mascot_settings").update({ equipped_title_id: null }).eq("equipped_title_id", rewardIdToDelete),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Ошибка при удалении дня из серии:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}