import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: crosswordId } = await ctx.params;

    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
    if (!auth.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const user = auth.user;

    const { data: crossword, error: cErr } = await supabase
      .from("crosswords")
      .select("*")
      .eq("id", crosswordId)
      .single();

    if (cErr || !crossword) {
      return NextResponse.json({ ok: false, error: cErr?.message || "Not found" }, { status: 404 });
    }

    const { data: access, error: accessErr } = await supabase
      .from("crossword_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("crossword_id", crosswordId)
      .maybeSingle();

    if (accessErr) return NextResponse.json({ ok: false, error: accessErr.message }, { status: 500 });

    const isAllowed = Boolean(crossword.is_available || access);
    if (!isAllowed) {
      return NextResponse.json({ ok: true, locked: true, crossword }, { status: 200 });
    }

    const { data: assignments, error: asgErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("crossword_id", crosswordId)
      .order("order_index");

    if (asgErr) return NextResponse.json({ ok: false, error: asgErr.message }, { status: 500 });

    const asg = assignments ?? [];
    const ids = asg.map((a: any) => a.id);

    // ✅ ВАЖНО: только завершённые, + score
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
      { ok: true, locked: false, crossword, assignments: asg, userProgress },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500 });
  }
}
