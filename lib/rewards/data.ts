// lib/rewards/data.ts
// Серверный слой работы с базой данных Supabase: Маскот, Стрики и Промокоды.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MascotSettings,
  RewardItem,
  RewardType,
  StreakConfigItem,
  StreakLeaderboardEntry,
  StreakStats,
  UserInventoryItem,
  PromocodeRedeemResult,
  PromocodeRewardsBundle,
} from "./types";

// ---------------------------------------------------------------------------
// 1. МАСКОТ И НАСТРОЙКИ ЭКИПИРОВКИ
// ---------------------------------------------------------------------------

export async function getMascotSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<MascotSettings> {
  const { data: rawSettings } = await supabase
    .from("mascot_settings")
    .select(
      `
      user_id,
      equipped_base_id,
      equipped_hat_id,
      equipped_aura_id,
      equipped_emotion_id,
      equipped_title_id,
      updated_at,
      equipped_base:rewards!mascot_settings_equipped_base_id_fkey(*),
      equipped_hat:rewards!mascot_settings_equipped_hat_id_fkey(*),
      equipped_aura:rewards!mascot_settings_equipped_aura_id_fkey(*),
      equipped_emotion:rewards!mascot_settings_equipped_emotion_id_fkey(*),
      equipped_title:rewards!mascot_settings_equipped_title_id_fkey(*)
    `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!rawSettings) {
    return {
      user_id: userId,
      equipped_base_id: null,
      equipped_hat_id: null,
      equipped_aura_id: null,
      equipped_emotion_id: null,
      equipped_title_id: null,
      updated_at: new Date().toISOString(),
    };
  }

  return rawSettings as unknown as MascotSettings;
}

export async function equipMascotItem(
  supabase: SupabaseClient,
  userId: string,
  category: RewardType,
  rewardId: string | null
): Promise<{ success: boolean; error?: string }> {
  if (rewardId) {
    const { data: hasItem } = await supabase
      .from("user_inventory")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_id", rewardId)
      .maybeSingle();

    if (!hasItem) {
      return { success: false, error: "У вас нет этой награды в инвентаре." };
    }
  }

  const columnMap: Record<RewardType, string> = {
    base: "equipped_base_id",
    hat: "equipped_hat_id",
    aura: "equipped_aura_id",
    emotion: "equipped_emotion_id",
    title: "equipped_title_id",
  };

  const targetColumn = columnMap[category];
  if (!targetColumn) {
    return { success: false, error: "Неверная категория элемента." };
  }

  const payload = {
    user_id: userId,
    [targetColumn]: rewardId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("mascot_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// 2. ИНВЕНТАРЬ ПОЛЬЗОВАТЕЛЯ
// ---------------------------------------------------------------------------

export async function getUserInventory(
  supabase: SupabaseClient,
  userId: string
): Promise<UserInventoryItem[]> {
  const { data, error } = await supabase
    .from("user_inventory")
    .select("*, reward:rewards(*)")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error || !Array.isArray(data)) return [];
  return data as unknown as UserInventoryItem[];
}

// ---------------------------------------------------------------------------
// 3. ДОРОЖКА СЕРИИ (СТРИКИ) И ЛИДЕРБОРД
// ---------------------------------------------------------------------------

export async function getStreakPath(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  stats: StreakStats;
  path: StreakConfigItem[];
}> {
  const [{ data: profile }, { data: streakConfig }, { data: inventory }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("current_streak, max_streak, last_completed_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("streak_config")
        .select("day_number, reward_id, created_at, reward:rewards(*)")
        .order("day_number", { ascending: true }),
      supabase
        .from("user_inventory")
        .select("reward_id")
        .eq("user_id", userId)
        .eq("source", "streak"),
    ]);

  const currentStreak = Number(profile?.current_streak || 0);
  const maxStreak = Number(profile?.max_streak || currentStreak);
  const lastCompletedAt = profile?.last_completed_at ? String(profile.last_completed_at) : null;

  // Проверка выполнения хотя бы одного задания сегодня
  let completedToday = false;
  if (lastCompletedAt) {
    const lastDate = new Date(lastCompletedAt).toISOString().split("T")[0];
    const todayDate = new Date().toISOString().split("T")[0];
    completedToday = lastDate === todayDate;
  }

  const claimedRewardIds = new Set(
    Array.isArray(inventory) ? inventory.map((item) => item.reward_id) : []
  );

  const path: StreakConfigItem[] = Array.isArray(streakConfig)
    ? streakConfig.map((item: any) => {
        const isClaimed = claimedRewardIds.has(item.reward_id);
        const isAvailable = currentStreak >= item.day_number && !isClaimed;
        return {
          ...item,
          is_claimed: isClaimed,
          is_available: isAvailable,
        };
      })
    : [];

  return {
    stats: {
      currentStreak,
      maxStreak,
      completedToday,
      lastCompletedAt,
    },
    path,
  };
}

export async function getStreakLeaderboard(
  supabase: SupabaseClient,
  currentUserId?: string
): Promise<StreakLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, current_streak, max_streak")
    .order("max_streak", { ascending: false })
    .order("current_streak", { ascending: false })
    .limit(20);

  if (error || !Array.isArray(data)) return [];

  return data.map((row: any, index: number) => ({
    rank: index + 1,
    user_id: row.id,
    current_streak: Number(row.current_streak || 0),
    max_streak: Number(row.max_streak || row.current_streak || 0),
    is_current_user: row.id === currentUserId,
  }));
}

export async function claimStreakReward(
  supabase: SupabaseClient,
  userId: string,
  dayNumber: number
): Promise<{ success: boolean; reward?: RewardItem; error?: string }> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("current_streak")
    .eq("id", userId)
    .maybeSingle();

  const currentStreak = Number(profile?.current_streak || 0);
  if (currentStreak < dayNumber) {
    return { success: false, error: "Вы ещё не достигли этого дня серии." };
  }

  const { data: streakConfig } = await supabase
    .from("streak_config")
    .select("reward_id, reward:rewards(*)")
    .eq("day_number", dayNumber)
    .maybeSingle();

  if (!streakConfig || !streakConfig.reward_id) {
    return { success: false, error: "Награда для этого дня не настроена." };
  }

  const rewardId = streakConfig.reward_id;

  const { error: insertError } = await supabase.from("user_inventory").insert({
    user_id: userId,
    reward_id: rewardId,
    source: "streak",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { success: false, error: "Награда за этот день уже получена." };
    }
    return { success: false, error: insertError.message };
  }

  return {
    success: true,
    reward: streakConfig.reward as unknown as RewardItem,
  };
}

// ---------------------------------------------------------------------------
// 4. ПРОМОКОДЫ И АКТИВАЦИЯ
// ---------------------------------------------------------------------------

export async function redeemPromocode(
  supabase: SupabaseClient,
  userId: string,
  rawCode: string,
  chosenMaterialIds: string[] = []
): Promise<PromocodeRedeemResult> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { success: false, error: "Введите промокод." };

  const { data: promo, error: promoError } = await supabase
    .from("promocodes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (promoError || !promo) {
    return { success: false, error: "Промокод не найден." };
  }

  if (!promo.is_active) {
    return { success: false, error: "Промокод деактивирован." };
  }

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { success: false, error: "Срок действия промокода истёк." };
  }

  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { success: false, error: "Лимит активаций промокода исчерпан." };
  }

  const { data: existingRedemption } = await supabase
    .from("promocode_redemptions")
    .select("id")
    .eq("promocode_id", promo.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingRedemption) {
    return { success: false, error: "Вы уже активировали этот промокод." };
  }

  const bundle: PromocodeRewardsBundle = promo.rewards_bundle || {};
  const requiredChoiceCount = Number(bundle.material_choice_count || 0);

  if (requiredChoiceCount > 0 && chosenMaterialIds.length < requiredChoiceCount) {
    return {
      success: true,
      requiresMaterialChoice: true,
      remainingMaterialChoices: requiredChoiceCount - chosenMaterialIds.length,
      physicalPrize: bundle.custom_physical || null,
    };
  }

  const grantedRewards: RewardItem[] = [];

  if (Array.isArray(bundle.reward_ids) && bundle.reward_ids.length > 0) {
    const inventoryRows = bundle.reward_ids.map((rewardId) => ({
      user_id: userId,
      reward_id: rewardId,
      source: "promocode" as const,
    }));

    await supabase
      .from("user_inventory")
      .upsert(inventoryRows, { onConflict: "user_id,reward_id" });

    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("*")
      .in("id", bundle.reward_ids);

    if (Array.isArray(rewardsData)) {
      grantedRewards.push(...(rewardsData as unknown as RewardItem[]));
    }
  }

  const allMaterialIdsToGrant = [
    ...(bundle.specific_material_ids || []),
    ...chosenMaterialIds,
  ].filter(Boolean);

  if (allMaterialIdsToGrant.length > 0) {
    const accessRows = allMaterialIdsToGrant.map((mId) => ({
      user_id: userId,
      material_id: mId,
    }));

    await supabase
      .from("material_access")
      .upsert(accessRows, { onConflict: "user_id,material_id" });
  }

  const { error: rpcError } = await supabase.rpc("increment_promocode_uses", {
    promo_id: promo.id,
  });

  if (rpcError) {
    await supabase
      .from("promocodes")
      .update({ current_uses: (promo.current_uses || 0) + 1 })
      .eq("id", promo.id);
  }

  await supabase.from("promocode_redemptions").insert({
    promocode_id: promo.id,
    user_id: userId,
    chosen_material_ids: chosenMaterialIds,
  });

  return {
    success: true,
    requiresMaterialChoice: false,
    grantedRewards,
    physicalPrize: bundle.custom_physical || null,
    grantedMaterialIds: allMaterialIdsToGrant,
  };
}