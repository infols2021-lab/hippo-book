import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { ok, fail } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      return fail("Unauthorized", 401, "UNAUTHORIZED");
    }

    const userId = authData.user.id;
    const admin = getSupabaseAdminClient();

    const { data: refLink } = await admin
      .from("user_referrals")
      .select("id, referrer_id, welcome_bonus_granted")
      .eq("referred_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!refLink) {
      return fail("Реферальная связь не найдена", 404, "NOT_FOUND");
    }

    if (refLink.welcome_bonus_granted) {
      return fail("Бонус уже получен", 400, "ALREADY_CLAIMED");
    }

    await admin
      .from("user_referrals")
      .update({ welcome_bonus_granted: true })
      .eq("id", refLink.id);

    const { data: settings } = await admin
      .from("referral_settings")
      .select("welcome_bundle")
      .eq("id", 1)
      .single();

    const grantedItems: any[] = [];
    
    if (settings?.welcome_bundle) {
      const bundle = settings.welcome_bundle;
      
      if (Array.isArray(bundle.rewards) && bundle.rewards.length > 0) {
        const { data: rData } = await admin.from("rewards").select("*").in("id", bundle.rewards);
        for (const rid of bundle.rewards) {
          await admin.from("user_inventory").upsert({
            user_id: userId,
            reward_id: rid,
            source: "referral_welcome"
          }, { onConflict: "user_id,reward_id" });
          
          const rInfo = rData?.find(r => r.id === rid);
          if (rInfo) {
            grantedItems.push({
               id: rInfo.id,
               title: rInfo.title,
               type: rInfo.type,
               description: "Приветственный бонус",
               asset_url: rInfo.asset_url
            });
          }
        }
      }

      if (Array.isArray(bundle.materials) && bundle.materials.length > 0) {
        const [
          { data: fetchedMaterials },
          { data: fetchedTextbooks },
          { data: fetchedCrosswords },
        ] = await Promise.all([
          admin.from("materials").select("id, title, cover_image_url").in("id", bundle.materials),
          admin.from("textbooks").select("id, title, cover_image_url").in("id", bundle.materials),
          admin.from("crosswords").select("id, title, cover_image_url").in("id", bundle.materials),
        ]);
        
        const mats = [...(fetchedMaterials||[]), ...(fetchedTextbooks||[]), ...(fetchedCrosswords||[])];

        for (const mid of bundle.materials) {
          await admin.from("material_access").upsert({
            user_id: userId,
            material_id: mid,
            granted_by: refLink.referrer_id
          }, { onConflict: "user_id,material_id" });
          
          const mInfo = mats.find(m => m.id === mid);
          if (mInfo) {
             grantedItems.push({
               id: mInfo.id,
               title: mInfo.title,
               type: "material",
               description: "Приветственный бонус",
               asset_url: mInfo.cover_image_url
             });
          }
        }
      }
    }

    return ok({
      success: true,
      grantedRewards: grantedItems
    });
  } catch (e: any) {
    return fail(e.message, 500, "SERVER_ERROR");
  }
}