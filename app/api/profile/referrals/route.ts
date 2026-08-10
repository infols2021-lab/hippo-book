import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authErr } = await supabase.auth.getUser();

    if (authErr || !authData.user) {
      return fail("Unauthorized", 401, "UNAUTHORIZED");
    }

    const userId = authData.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("referrals_count, referral_materials_purchased")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    const { data: track, error: trackErr } = await supabase
      .from("referral_config")
      .select(`
        id,
        purchases_required,
        reward_id,
        rewards (
          id, title, type, asset_url, description
        )
      `)
      .order("purchases_required", { ascending: true });

    if (trackErr) throw trackErr;

    const { data: inventory, error: invErr } = await supabase
      .from("user_inventory")
      .select("reward_id")
      .eq("user_id", userId)
      .eq("source", "referral");

    if (invErr) throw invErr;

    const unlockedRewardIds = new Set(inventory?.map((i) => i.reward_id) || []);

    const origin = req.nextUrl.origin;

    return ok({
      referral_link: `${origin}/register?ref=${userId}`,
      stats: {
        count: profile?.referrals_count || 0,
        materials_purchased: profile?.referral_materials_purchased || 0,
      },
      track: track?.map((t: any) => ({
        id: t.id,
        purchases_required: t.purchases_required,
        reward: t.rewards,
        is_unlocked: t.reward_id ? unlockedRewardIds.has(t.reward_id) : false,
      })) || [],
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}