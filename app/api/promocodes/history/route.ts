import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Неавторизован" }, { status: 401 });
    }

    const { data: redemptions, error: redemptionsError } = await supabase
      .from("promocode_redemptions")
      .select(`
        id,
        promocode_id,
        chosen_material_ids,
        redeemed_at,
        promocodes (
          code,
          rewards_bundle
        )
      `)
      .eq("user_id", user.id)
      .order("redeemed_at", { ascending: false });

    if (redemptionsError) {
      console.error("Error fetching user promo history:", redemptionsError);
      return NextResponse.json({ error: "Ошибка загрузки истории" }, { status: 500 });
    }

    if (!redemptions || redemptions.length === 0) {
      return NextResponse.json({ ok: true, history: [] });
    }

    const allRewardIds = new Set<string>();
    const allMaterialIds = new Set<string>();

    redemptions.forEach((r: any) => {
      const promo = r.promocodes;
      const bundle = promo?.rewards_bundle || {};

      if (Array.isArray(bundle.reward_ids)) {
        bundle.reward_ids.forEach((id: string) => allRewardIds.add(id));
      }
      if (Array.isArray(bundle.specific_material_ids)) {
        bundle.specific_material_ids.forEach((id: string) => allMaterialIds.add(id));
      }
      if (Array.isArray(r.chosen_material_ids)) {
        r.chosen_material_ids.forEach((id: string) => allMaterialIds.add(id));
      }
    });

    let rewardMap: Record<string, string> = {};
    if (allRewardIds.size > 0) {
      // ИСПРАВЛЕНИЕ: rewards_catalog -> rewards согласно схеме БД
      const { data: rewards } = await supabase
        .from("rewards")
        .select("id, title")
        .in("id", Array.from(allRewardIds));

      if (rewards) {
        rewards.forEach((item: { id: string; title: string }) => {
          rewardMap[item.id] = item.title;
        });
      }
    }

    let materialMap: Record<string, string> = {};
    if (allMaterialIds.size > 0) {
      const { data: materials } = await supabase
        .from("materials")
        .select("id, title")
        .in("id", Array.from(allMaterialIds));

      if (materials) {
        materials.forEach((item: { id: string; title: string }) => {
          materialMap[item.id] = item.title;
        });
      }
    }

    const history = redemptions.map((r: any) => {
      const promo = r.promocodes || {};
      const bundle = promo.rewards_bundle || {};

      const rewardTitles = (bundle.reward_ids || [])
        .map((id: string) => rewardMap[id])
        .filter(Boolean);

      const bundleMaterialTitles = (bundle.specific_material_ids || [])
        .map((id: string) => materialMap[id])
        .filter(Boolean);

      const chosenMaterialTitles = (r.chosen_material_ids || [])
        .map((id: string) => materialMap[id])
        .filter(Boolean);

      const allMaterialTitles = Array.from(
        new Set([...bundleMaterialTitles, ...chosenMaterialTitles])
      );

      return {
        id: r.id,
        code: promo.code || "ПРОМОКОД",
        redeemed_at: r.redeemed_at,
        granted_reward_titles: rewardTitles,
        granted_material_titles: allMaterialTitles,
        physical_prize: bundle.custom_physical || null,
      };
    });

    return NextResponse.json({ ok: true, history });
  } catch (e: any) {
    console.error("Server error fetching promo history:", e);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}