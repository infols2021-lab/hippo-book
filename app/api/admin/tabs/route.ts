import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  
  // Проверка прав (опционально, если у тебя есть функция проверки админа)
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, project_id, name, slug, icon, is_active, order_index } = body;

    if (id) {
      // Обновление существующего таба
      const { error } = await supabase
        .from("project_tabs")
        .update({ name, slug, icon, is_active, order_index })
        .eq("id", id);
      if (error) throw error;
    } else {
      // Создание нового таба
      const { error } = await supabase
        .from("project_tabs")
        .insert([{ project_id, name, slug, icon, is_active, order_index }]);
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  try {
    const { error } = await supabase.from("project_tabs").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}