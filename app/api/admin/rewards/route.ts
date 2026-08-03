// app/api/admin/rewards/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RewardType } from "@/lib/rewards/types";

const VALID_TYPES: RewardType[] = ["hat", "aura", "emotion", "base", "title"];

async function verifyAdmin(supabase: any) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, error: "Необходима авторизация" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true || profile?.role === "admin";
  if (!isAdmin) {
    return { user: null, error: "Доступ запрещен. Требуются права администратора" };
  }

  return { user, error: null };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error: adminErr } = await verifyAdmin(supabase);
    if (adminErr) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ rewards: data || [] });
  } catch (error: any) {
    console.error("Ошибка при получении каталога наград:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error: adminErr } = await verifyAdmin(supabase);
    if (adminErr) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Невалидный JSON" }, { status: 400 });
    }

    const { id, type, title, description, asset_url, meta } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Укажите название награды" },
        { status: 400 }
      );
    }

    if (!type || !VALID_TYPES.includes(type as RewardType)) {
      return NextResponse.json(
        { error: "Укажите корректный тип награды (hat, aura, emotion, base, title)" },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {
      type,
      title: title.trim(),
      description: description ? String(description).trim() : null,
      asset_url: asset_url ? String(asset_url).trim() : null,
      meta: meta && typeof meta === "object" ? meta : {},
    };

    if (id) {
      payload.id = id;
    }

    const { data, error } = await supabase
      .from("rewards")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, reward: data });
  } catch (error: any) {
    console.error("Ошибка при сохранении награды:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { error: adminErr } = await verifyAdmin(supabase);
    if (adminErr) {
      return NextResponse.json({ error: adminErr }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Укажите id награды" }, { status: 400 });
    }

    const { error } = await supabase.from("rewards").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Ошибка при удалении награды:", error);
    return NextResponse.json(
      { error: error?.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}