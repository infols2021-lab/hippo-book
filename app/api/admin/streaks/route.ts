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

    const { error } = await adminSupabase
      .from("streak_config")
      .delete()
      .eq("day_number", dayNumber);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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