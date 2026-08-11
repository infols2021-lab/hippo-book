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

    const { data: milestonesData, error } = await adminSupabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (error) throw error;

    const { data: settingsData } = await adminSupabase
      .from("referral_settings")
      .select("welcome_bundle")
      .eq("id", 1)
      .single();

    return NextResponse.json({ 
      milestones: milestonesData || [],
      welcome_bundle: settingsData?.welcome_bundle || { rewards: [], materials: [], choice_count: 0, has_physical: false, max_price: 0 }
    });
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
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const incomingMilestones = body.milestones;
    const incomingWelcomeBundle = body.welcome_bundle;

    if (incomingWelcomeBundle) {
      const bundleToSave = {
        ...incomingWelcomeBundle,
        max_price: Number(incomingWelcomeBundle.max_price) || 0
      };
      
      const { error: settingsErr } = await adminSupabase
        .from("referral_settings")
        .upsert({ id: 1, welcome_bundle: bundleToSave });

      if (settingsErr) throw settingsErr;
    }

    if (Array.isArray(incomingMilestones)) {
      const { data: currentData, error: fetchErr } = await adminSupabase
        .from("referral_config")
        .select("id");

      if (fetchErr) throw fetchErr;

      const incomingIds = new Set(incomingMilestones.map((m: any) => m.id).filter(Boolean));
      const currentIds = currentData?.map((m: any) => m.id) || [];

      const idsToDelete = currentIds.filter((id) => !incomingIds.has(id));
      if (idsToDelete.length > 0) {
        const { error: delErr } = await adminSupabase
          .from("referral_config")
          .delete()
          .in("id", idsToDelete);

        if (delErr) throw delErr;
      }

      if (incomingMilestones.length > 0) {
        const payload = incomingMilestones.map((m: any) => ({
          id: m.id || crypto.randomUUID(),
          purchases_required: Number(m.purchases_required),
          rewards_bundle: m.rewards_bundle ? {
            ...m.rewards_bundle,
            max_price: Number(m.rewards_bundle.max_price) || 0
          } : {
            rewards: [],
            materials: [],
            choice_count: 0,
            has_physical: false,
            max_price: 0
          },
        }));

        const { error: upsertErr } = await adminSupabase
          .from("referral_config")
          .upsert(payload, { onConflict: "id" });

        if (upsertErr) throw upsertErr;
      }
    }

    const { data: finalData, error: finalErr } = await adminSupabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (finalErr) throw finalErr;

    const { data: finalSettings } = await adminSupabase
      .from("referral_settings")
      .select("welcome_bundle")
      .eq("id", 1)
      .single();

    return NextResponse.json({ 
      success: true, 
      milestones: finalData,
      welcome_bundle: finalSettings?.welcome_bundle 
    });
  } catch (error: any) {
    console.error("POST Referral Config Error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}