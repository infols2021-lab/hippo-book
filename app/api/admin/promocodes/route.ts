// app/api/admin/promocodes/route.ts
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
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true || profile?.role === "admin";
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

    const [{ data: promocodes, error: promoErr }, { data: redemptions, error: redemptionsErr }] =
      await Promise.all([
        adminSupabase
          .from("promocodes")
          .select("*")
          .order("created_at", { ascending: false }),
        adminSupabase
          .from("promocode_redemptions")
          .select(`
            id,
            promocode_id,
            user_id,
            chosen_material_ids,
            redeemed_at,
            promocodes(code),
            profiles:user_id(email, full_name)
          `)
          .order("redeemed_at", { ascending: false })
          .limit(150),
      ]);

    if (promoErr) {
      return NextResponse.json({ error: promoErr.message }, { status: 400 });
    }

    const formattedRedemptions = Array.isArray(redemptions)
      ? redemptions.map((r: any) => ({
          id: r.id,
          promocode_id: r.promocode_id,
          promocode_code: r.promocodes?.code || "—",
          user_id: r.user_id,
          user_email: r.profiles?.email || "—",
          user_full_name: r.profiles?.full_name || "Ученик",
          chosen_material_ids: r.chosen_material_ids || [],
          redeemed_at: r.redeemed_at,
        }))
      : [];

    return NextResponse.json({
      promocodes: promocodes || [],
      redemptions: formattedRedemptions,
      error: redemptionsErr?.message || null,
    });
  } catch (error: any) {
    console.error("Ошибка при получении промокодов и логов:", error);
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

    const {
      id,
      code,
      is_active,
      max_uses,
      expires_at,
      rewards_bundle,
    } = body;

    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!normalizedCode) {
      return NextResponse.json(
        { error: "Укажите значение промокода" },
        { status: 400 }
      );
    }

    let parsedMaxUses: number | null = null;
    if (max_uses !== null && max_uses !== undefined && max_uses !== "") {
      const num = Number(max_uses);
      if (Number.isInteger(num) && num > 0) {
        parsedMaxUses = num;
      }
    }

    let parsedExpiresAt: string | null = null;
    if (expires_at) {
      const date = new Date(expires_at);
      if (!isNaN(date.getTime())) {
        parsedExpiresAt = date.toISOString();
      }
    }

    const bundle = rewards_bundle && typeof rewards_bundle === "object" ? rewards_bundle : {};
    const sanitizedBundle = {
      reward_ids: Array.isArray(bundle.reward_ids) ? bundle.reward_ids.map(String) : [],
      specific_material_ids: Array.isArray(bundle.specific_material_ids) ? bundle.specific_material_ids.map(String) : [],
      material_choice_count: Math.max(0, Number(bundle.material_choice_count || 0)),
      custom_physical: bundle.custom_physical && typeof bundle.custom_physical === "object" ? {
        title: String(bundle.custom_physical.title || "").trim(),
        text: String(bundle.custom_physical.text || "").trim(),
        image_url: bundle.custom_physical.image_url ? String(bundle.custom_physical.image_url).trim() : null,
      } : null,
    };

    const payload: Record<string, any> = {
      code: normalizedCode,
      is_active: typeof is_active === "boolean" ? is_active : true,
      max_uses: parsedMaxUses,
      expires_at: parsedExpiresAt,
      rewards_bundle: sanitizedBundle,
    };

    if (id) {
      payload.id = id;
    }

    const { data, error } = await adminSupabase
      .from("promocodes")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Промокод с таким названием уже существует" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, promocode: data });
  } catch (error: any) {
    console.error("Ошибка при сохранении промокода:", error);
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Укажите id промокода" }, { status: 400 });
    }

    const { error } = await adminSupabase.from("promocodes").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Ошибка при удалении промокода:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}