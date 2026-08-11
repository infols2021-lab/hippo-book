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

    // Получаем стату профиля
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("referrals_count, referral_materials_purchased")
      .eq("id", userId)
      .single();

    if (profileErr) throw profileErr;

    const materialsPurchased = profile?.referral_materials_purchased || 0;

    // Получаем саму дорожку
    const { data: track, error: trackErr } = await supabase
      .from("referral_config")
      .select("*")
      .order("purchases_required", { ascending: true });

    if (trackErr) throw trackErr;

    // Подтягиваем словари наград и материалов для красивого отображения на фронте
    const [{ data: allRewards }, { data: allMaterials }] = await Promise.all([
      supabase.from("rewards").select("id, title, type, asset_url"),
      supabase.from("materials").select("id, title")
    ]);

    const rewardsMap = new Map((allRewards || []).map(r => [r.id, r]));
    const materialsMap = new Map((allMaterials || []).map(m => [m.id, m]));

    const enrichedTrack = (track || []).map((t: any) => {
      const bundle = t.rewards_bundle || { rewards: [], materials: [] };
      
      // Вытаскиваем первую награду из бандла для отрисовки иконки на дорожке
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
        // Этап разблокирован, если покупок больше или равно требуемому
        is_unlocked: materialsPurchased >= t.purchases_required,
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
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}