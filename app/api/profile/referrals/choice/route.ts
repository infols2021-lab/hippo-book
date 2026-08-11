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
      .select("referral_materials_purchased")
      .eq("id", userId)
      .single();

    const purchasedCount = profile?.referral_materials_purchased || 0;

    const { data: milestone } = await supabase
      .from("referral_config")
      .select("*")
      .eq("id", milestoneId)
      .single();

    if (!milestone) {
      return fail("Этап не найден", 404, "NOT_FOUND");
    }

    if (purchasedCount < milestone.purchases_required) {
      return fail("Вы еще не достигли этого этапа", 403, "FORBIDDEN");
    }

    const { data: existingClaim } = await supabase
      .from("user_inventory")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_id", milestoneId)
      .eq("source", "referral_choice")
      .maybeSingle();

    if (existingClaim) {
      return fail("Выбор для этого этапа уже сделан", 400, "ALREADY_CLAIMED");
    }

    const bundle = milestone.rewards_bundle || {};
    const choiceCount = Number(bundle.choice_count) || 0;
    const maxPrice = Number(bundle.max_price) || 0;

    if (choiceCount > 0 && chosenMaterialIds.length !== choiceCount && chosenMaterialIds.length > 0) {
      return fail(`Необходимо выбрать ровно ${choiceCount} материал(а)`, 400, "VALIDATION");
    }

    const admin = getSupabaseAdminClient();
    const grantedItems: any[] = [];

    if (chosenMaterialIds.length > 0) {
      const materialsMap = await fetchMaterialsByIds(admin, chosenMaterialIds);
      
      for (const mid of chosenMaterialIds) {
        const mat = materialsMap.get(mid);
        if (!mat) {
          return fail(`Материал ${mid} не найден`, 404, "NOT_FOUND");
        }
        if (maxPrice > 0 && Number(mat.price || 0) > maxPrice) {
          return fail(`Материал "${mat.title}" превышает лимит цены для этого этапа`, 400, "PRICE_LIMIT");
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
          description: "Получено по реферальной программе",
          asset_url: mat?.cover_image_url || null,
          meta: {}
        });
      }
    }

    await admin.from("user_inventory").insert({
      user_id: userId,
      reward_id: milestoneId,
      source: "referral_choice"
    });

    return ok({
      success: true,
      grantedRewards: grantedItems
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}