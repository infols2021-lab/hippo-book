import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchMaterialsByIds(supabase: any, materialIds: string[]) {
  if (!materialIds || materialIds.length === 0) return new Map();

  const [
    { data: fetchedMaterials },
    { data: fetchedTextbooks },
    { data: fetchedCrosswords },
  ] = await Promise.all([
    supabase.from("materials").select("id, title, price, cover_image_url").in("id", materialIds),
    supabase.from("textbooks").select("id, title, price, cover_image_url").in("id", materialIds),
    supabase.from("crosswords").select("id, title, price, cover_image_url").in("id", materialIds),
  ]);

  const map = new Map<string, any>();
  if (Array.isArray(fetchedMaterials)) {
    fetchedMaterials.forEach(m => map.set(String(m.id), { ...m, type: "material" }));
  }
  if (Array.isArray(fetchedTextbooks)) {
    fetchedTextbooks.forEach(m => {
      if (!map.has(String(m.id))) map.set(String(m.id), { ...m, type: "textbook" });
    });
  }
  if (Array.isArray(fetchedCrosswords)) {
    fetchedCrosswords.forEach(m => {
      if (!map.has(String(m.id))) map.set(String(m.id), { ...m, type: "crossword" });
    });
  }

  return map;
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

    if (!body || !body.milestoneId || !Array.isArray(body.chosenMaterialIds)) {
      return fail("Некорректные данные запроса", 400, "VALIDATION");
    }

    const milestoneId = String(body.milestoneId);
    const chosenMaterialIds = body.chosenMaterialIds.map(String);

    const { data: profile } = await supabase
      .from("profiles")
      .select("referral_materials_purchased, claimed_referral_milestones")
      .eq("id", userId)
      .single();

    const purchasedCount = profile?.referral_materials_purchased || 0;
    const claimedMilestones = profile?.claimed_referral_milestones || [];

    if (claimedMilestones.includes(milestoneId)) {
      return fail("Этап уже получен", 400, "ALREADY_CLAIMED");
    }

    const { data: milestone } = await supabase
      .from("referral_config")
      .select("*")
      .eq("id", milestoneId)
      .single();

    if (!milestone) return fail("Этап не найден", 404, "NOT_FOUND");
    if (purchasedCount < milestone.purchases_required) return fail("Вы еще не достигли этого этапа", 403, "FORBIDDEN");

    const bundle = milestone.rewards_bundle || {};
    const choiceCount = Number(bundle.choice_count) || 0;
    const maxPrice = Number(bundle.max_price) || 0;

    if (choiceCount > 0 && chosenMaterialIds.length !== choiceCount && chosenMaterialIds.length > 0) {
      return fail(`Необходимо выбрать ровно ${choiceCount} материал(а)`, 400, "VALIDATION");
    }

    const admin = getSupabaseAdminClient();
    const grantedItems: any[] = [];
    
    if (Array.isArray(bundle.rewards) && bundle.rewards.length > 0) {
      const { data: rData } = await admin.from("rewards").select("*").in("id", bundle.rewards);
      for (const rid of bundle.rewards) {
         await admin.from("user_inventory").upsert({
           user_id: userId,
           reward_id: rid,
           source: "referral_milestone"
         }, { onConflict: "user_id,reward_id" });
         
         const rInfo = rData?.find(r => r.id === rid);
         if (rInfo) {
            grantedItems.push({
               id: rInfo.id,
               title: rInfo.title,
               type: rInfo.type,
               description: "Награда за приглашение друзей",
               asset_url: rInfo.asset_url
            });
         }
      }
    }

    const allMatsToFetch = [...(bundle.materials || []), ...chosenMaterialIds];
    const materialsMap = await fetchMaterialsByIds(admin, allMatsToFetch);

    if (Array.isArray(bundle.materials) && bundle.materials.length > 0) {
      for (const mid of bundle.materials) {
        await admin.from("material_access").upsert({
          user_id: userId,
          material_id: mid,
          granted_by: userId
        }, { onConflict: "user_id,material_id" });
        
        const mat = materialsMap.get(mid);
        grantedItems.push({
          id: mid,
          title: mat?.title || "Материал",
          type: "material",
          description: "Награда за приглашение друзей",
          asset_url: mat?.cover_image_url || null
        });
      }
    }

    if (chosenMaterialIds.length > 0) {
      for (const mid of chosenMaterialIds) {
        const mat = materialsMap.get(mid);
        if (!mat) return fail(`Материал ${mid} не найден`, 404, "NOT_FOUND");
        if (maxPrice > 0 && Number(mat.price || 0) > maxPrice) {
          return fail(`Материал "${mat.title}" превышает лимит цены`, 400, "PRICE_LIMIT");
        }
      }

      for (const mid of chosenMaterialIds) {
        await admin.from("material_access").upsert({
          user_id: userId,
          material_id: mid,
          granted_by: userId
        }, { onConflict: "user_id,material_id" });

        const mat = materialsMap.get(mid);
        grantedItems.push({
          id: mid,
          title: mat?.title || "Материал",
          type: "material",
          description: "Выбранная награда",
          asset_url: mat?.cover_image_url || null
        });
      }
    }

    await admin.from("profiles").update({
      claimed_referral_milestones: [...claimedMilestones, milestoneId]
    }).eq("id", userId);

    let physicalPrize = null;
    if (bundle.has_physical) {
      physicalPrize = { title: "Физический подарок за приглашения" };
    }

    return ok({
      success: true,
      grantedRewards: grantedItems,
      physicalPrize
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}