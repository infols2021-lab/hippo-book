import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  assignmentId: string;
  answers: any;
  isCompleted: boolean;
  score: number;
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr) return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
  if (!auth.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  if (!body?.assignmentId) {
    return NextResponse.json({ ok: false, error: "assignmentId required" }, { status: 400 });
  }

  // ✅ НЕ сохраняем незавершённое вообще
  if (!body.isCompleted) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const safeScore =
    Number.isFinite(body.score) ? Math.max(0, Math.min(100, Math.round(body.score))) : 0;

  const payload = {
    user_id: auth.user.id,
    assignment_id: body.assignmentId,
    answers: body.answers ?? {},
    is_completed: true,
    completed_at: new Date().toISOString(),
    score: safeScore,
  };

  const { data: existing, error: exErr } = await supabase
    .from("user_progress")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("assignment_id", body.assignmentId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  }

  const res = existing?.id
    ? await supabase.from("user_progress").update(payload).eq("id", existing.id)
    : await supabase.from("user_progress").insert(payload);

  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
