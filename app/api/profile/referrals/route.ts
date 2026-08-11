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

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("referrals_count, referral_materials_purchased")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    const materialsPurchased = profile?.referral_materials_purchased || 0;

    const { data: refLink } = await supabase
      .from("user_referrals")
      .select("referrer_id, profiles!user_referrals_referrer_id_fkey(full_name)")
      .eq("referred_id", userId)
      .eq("status", "active")
      .maybeSingle();

    let inviter = null;
    if (refLink && refLink.profiles) {
      inviter = {
        id: refLink.referrer_id,
        name: (refLink.profiles as any).full_name || "Неизвестный пользователь"
      };
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
        max_price: bundle.max_price || 0
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
      inviter: inviter
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

    const { data: refUser } = await supabase
      .from("profiles")
      .select("id, referrals_count")
      .eq("id", refId)
      .maybeSingle();

    if (!refUser) {
      return fail("Пользователь с таким кодом не найден", 404, "NOT_FOUND");
    }

    const admin = getSupabaseAdminClient();

    await admin.from("user_referrals").insert({
      referrer_id: refId,
      referred_id: userId,
      is_teacher_student: false,
      status: "active",
      welcome_bonus_granted: true
    });

    await admin
      .from("profiles")
      .update({ referrals_count: (refUser.referrals_count || 0) + 1 })
      .eq("id", refId);

    const { data: settings } = await admin
      .from("referral_settings")
      .select("welcome_bundle")
      .eq("id", 1)
      .single();

    if (settings?.welcome_bundle) {
      const bundle = settings.welcome_bundle;
      
      if (Array.isArray(bundle.rewards) && bundle.rewards.length > 0) {
        for (const rid of bundle.rewards) {
          await admin.from("user_inventory").upsert({
            user_id: userId,
            reward_id: rid,
            source: "referral_welcome"
          }, { onConflict: "user_id,reward_id" });
        }
      }

      if (Array.isArray(bundle.materials) && bundle.materials.length > 0) {
        for (const mid of bundle.materials) {
          await admin.from("material_access").upsert({
            user_id: userId,
            material_id: mid,
            granted_by: refId
          }, { onConflict: "user_id,material_id" });
        }
      }
    }

    return ok({ message: "Код успешно применен" });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}