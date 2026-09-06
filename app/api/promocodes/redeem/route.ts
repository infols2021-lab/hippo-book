import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redeemPromocode } from "@/lib/rewards/data";
import { checkRateLimit } from "@/lib/api/rateLimit";

// Анти-брутфорс: не более N попыток активации промокодов в окно на юзера+IP.
const REDEEM_LIMIT = 5;
const REDEEM_WINDOW_SEC = 60;

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0]?.trim() || "unknown";
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

    const rl = await checkRateLimit(
      `redeem_promocode:${user.id}:${clientIp(request)}`,
      REDEEM_LIMIT,
      REDEEM_WINDOW_SEC
    );
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Слишком много попыток активации. Попробуйте через минуту.", code: "RATE_LIMIT" },
        { status: 429, headers: { "Retry-After": String(REDEEM_WINDOW_SEC) } }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.code) {
      return NextResponse.json(
        { error: "Введите промокод" },
        { status: 400 }
      );
    }

    const { code, chosenMaterialIds, allowSkipIfAllUnlocked } = body;
    const normalizedChosenIds = Array.isArray(chosenMaterialIds)
      ? chosenMaterialIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    const result = await redeemPromocode(
      supabase,
      user.id,
      String(code).trim(),
      normalizedChosenIds,
      Boolean(allowSkipIfAllUnlocked)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Не удалось активировать промокод" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Ошибка при активации промокода:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера. Попробуйте позже." },
      { status: 500 }
    );
  }
}