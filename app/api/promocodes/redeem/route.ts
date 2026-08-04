// app/api/promocodes/redeem/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redeemPromocode } from "@/lib/rewards/data";

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
    if (!body || !body.code) {
      return NextResponse.json(
        { error: "Введите промокод" },
        { status: 400 }
      );
    }

    const { code, chosenMaterialIds } = body;
    const normalizedChosenIds = Array.isArray(chosenMaterialIds)
      ? chosenMaterialIds.map(String)
      : [];

    const result = await redeemPromocode(
      supabase,
      user.id,
      String(code),
      normalizedChosenIds
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Ошибка при активации промокода:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}