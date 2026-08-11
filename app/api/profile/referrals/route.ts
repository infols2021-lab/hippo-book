import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const admin = getSupabaseAdminClient();

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("referrals_count, referral_materials_purchased, claimed_referral_milestones")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    const materialsPurchased = profile?.referral_materials_purchased || 0;
    const claimedSet = new Set(profile?.claimed_referral_milestones || []);

    const { data: refLink } = await admin
      .from("user_referrals")
      .select("referrer_id, welcome_bonus_granted, profiles!user_referrals_referrer_id_fkey(full_name)")
      .eq("referred_id", userId)
      .eq("status", "active")
      .maybeSingle();

    let inviter = null;
    let welcomeBonusAvailable = false;
    
    if (refLink && refLink.profiles) {
      inviter = {
        id: refLink.referrer_id,
        name: (refLink.profiles as any).full_name || "Неизвестный пользователь"
      };
      welcomeBonusAvailable = refLink.welcome_bonus_granted === false;
    }

    const { data: track, error: trackErr } = await supabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (trackErr) throw trackErr;

    const [{ data: allRewards }, { data: allMaterials }] = await Promise.all([
      supabase.from("rewards").select("id, title, type, asset_url"),
      supabase.from("materials").select("id, title")
    ]);

    const rewardsMap = new Map((allRewards || []).map(r => [r.id, r]));
    const materialsMap = new Map((allMaterials || []).map(m => [m.id, m]));

    const enrichedTrack = (track || []).map((t: any) => {
      const bundle = t.rewards_bundle || { rewards: [], materials: [], max_price: 0 };
      
      let mainReward = null;
      if (bundle.rewards && bundle.rewards.length > 0) {
        mainReward = rewardsMap.get(bundle.rewards[0]);
      } else if (bundle.materials && bundle.materials.length > 0) {
        const mat = materialsMap.get(bundle.materials[0]);
        if (mat) mainReward = { title: mat.title, type: "material" };
      } else if (bundle.has_physical) {
        mainReward = { title: "Физический подарок", type: "physical" };
      }

      return {
        id: t.id,
        purchases_required: t.purchases_required,
        reward: mainReward,
        is_unlocked: materialsPurchased >= t.purchases_required,
        is_claimed: claimedSet.has(t.id),
        max_price: bundle.max_price || 0,
        choice_count: bundle.choice_count || 0
      };
    });

    const origin = req.nextUrl.origin;

    return ok({
      referral_link: `${origin}/register?ref=${userId}`,
      stats: {
        count: profile?.referrals_count || 0,
        materials_purchased: materialsPurchased,
      },
      track: enrichedTrack,
      inviter: inviter,
      welcome_bonus_available: welcomeBonusAvailable
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      return fail("Unauthorized", 401, "UNAUTHORIZED");
    }

    const userId = authData.user.id;
    const body = await req.json().catch(() => null);

    if (!body || !body.code) {
      return fail("Код приглашения не указан", 400, "VALIDATION");
    }

    let refId = body.code.trim();
    if (refId.includes("ref=")) {
      refId = refId.split("ref=")[1].split("&")[0];
    }

    if (refId === userId) {
      return fail("Вы не можете использовать собственный код", 400, "VALIDATION");
    }

    const { data: existingLink } = await supabase
      .from("user_referrals")
      .select("id")
      .eq("referred_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existingLink) {
      return fail("Вы уже ввели код приглашения", 400, "VALIDATION");
    }

    const { data: mutualLink } = await supabase
      .from("user_referrals")
      .select("id")
      .eq("referrer_id", userId)
      .eq("referred_id", refId)
      .eq("status", "active")
      .maybeSingle();

    if (mutualLink) {
      return fail("Взаимные приглашения запрещены", 400, "VALIDATION");
    }

    const admin = getSupabaseAdminClient();

    const { data: refUser } = await admin
      .from("profiles")
      .select("id, referrals_count")
      .eq("id", refId)
      .maybeSingle();

    if (!refUser) {
      return fail("Пользователь с таким кодом не найден", 404, "NOT_FOUND");
    }

    await admin.from("user_referrals").insert({
      referrer_id: refId,
      referred_id: userId,
      is_teacher_student: false,
      status: "active",
      welcome_bonus_granted: false
    });

    await admin
      .from("profiles")
      .update({ referrals_count: (refUser.referrals_count || 0) + 1 })
      .eq("id", refId);

    return ok({ message: "Код успешно применен" });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}