import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: textbookId } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
    if (!auth.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const user = auth.user;

    const { data: textbook, error: tErr } = await supabase
      .from("textbooks")
      .select("*")
      .eq("id", textbookId)
      .single();

    if (tErr || !textbook) {
      return NextResponse.json({ ok: false, error: tErr?.message || "Not found" }, { status: 404 });
    }

    const { data: access, error: accessErr } = await supabase
      .from("textbook_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("textbook_id", textbookId)
      .maybeSingle();

    if (accessErr) return NextResponse.json({ ok: false, error: accessErr.message }, { status: 500 });

    const isAllowed = Boolean(textbook.is_available || access);
    if (!isAllowed) {
      return NextResponse.json({ ok: true, locked: true, textbook }, { status: 200 });
    }

    const { data: assignments, error: asgErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("textbook_id", textbookId)
      .order("order_index");

    if (asgErr) return NextResponse.json({ ok: false, error: asgErr.message }, { status: 500 });

    const asg = assignments ?? [];
    const ids = asg.map((a: any) => a.id);

    // ✅ ВАЖНО: берём только завершённые и с score
    let userProgress: any[] = [];
    if (ids.length) {
      const { data: p, error: pErr } = await supabase
        .from("user_progress")
        .select("assignment_id,is_completed,score")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .in("assignment_id", ids);

      if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
      userProgress = p ?? [];
    }

    return NextResponse.json(
      { ok: true, locked: false, textbook, assignments: asg, userProgress },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
