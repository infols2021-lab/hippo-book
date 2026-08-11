import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const adminSupabase = getSupabaseAdminClient();

    const { data, error } = await adminSupabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ milestones: data || [] });
  } catch (error: any) {
    console.error("GET Referral Config Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("response" in auth) return auth.response;

    const adminSupabase = getSupabaseAdminClient();

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.milestones)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const incomingMilestones = body.milestones;

    // 1. Получаем текущие данные из БД
    const { data: currentData, error: fetchErr } = await adminSupabase
      .from("referral_config")
      .select("id");

    if (fetchErr) throw fetchErr;

    const incomingIds = new Set(incomingMilestones.map((m: any) => m.id).filter(Boolean));
    const currentIds = currentData?.map((m: any) => m.id) || [];

    // 2. Удаляем те, которых больше нет в присланном списке
    const idsToDelete = currentIds.filter((id) => !incomingIds.has(id));
    if (idsToDelete.length > 0) {
      const { error: delErr } = await adminSupabase
        .from("referral_config")
        .delete()
        .in("id", idsToDelete);

      if (delErr) throw delErr;
    }

    // 3. Добавляем / обновляем оставшиеся
    if (incomingMilestones.length > 0) {
      const payload = incomingMilestones.map((m: any) => ({
        id: m.id || crypto.randomUUID(),
        purchases_required: Number(m.purchases_required),
        // Сохраняем начинку бандла (как в промокодах)
        rewards_bundle: m.rewards_bundle || {
          rewards: [],
          materials: [],
          choice_count: 0,
          has_physical: false
        },
      }));

      const { error: upsertErr } = await adminSupabase
        .from("referral_config")
        .upsert(payload, { onConflict: "id" });

      if (upsertErr) throw upsertErr;
    }

    // 4. Возвращаем обновленный список
    const { data: finalData, error: finalErr } = await adminSupabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (finalErr) throw finalErr;

    return NextResponse.json({ success: true, milestones: finalData });
  } catch (error: any) {
    console.error("POST Referral Config Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}