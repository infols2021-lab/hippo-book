// lib/rewards/types.ts

export type RewardType = "hat" | "aura" | "emotion" | "base" | "title";

export type RewardMeta = {
  offset_x?: number;
  offset_y?: number;
  scale?: number;
  color?: string;
  gradient?: string;
  css_class?: string;
  [key: string]: unknown;
};

export type RewardItem = {
  id: string;
  type: RewardType;
  title: string;
  description: string | null;
  asset_url: string | null;
  meta: RewardMeta;
  created_at: string;
};

export type InventorySource = "streak" | "promocode" | "event" | "legacy";

export type UserInventoryItem = {
  id: string;
  user_id: string;
  reward_id: string;
  source: InventorySource;
  unlocked_at: string;
  reward?: RewardItem;
};

export type MascotSettings = {
  user_id: string;
  equipped_base_id: string | null;
  equipped_hat_id: string | null;
  equipped_aura_id: string | null;
  equipped_emotion_id: string | null;
  equipped_title_id: string | null;
  updated_at: string;

  equipped_base?: RewardItem | null;
  equipped_hat?: RewardItem | null;
  equipped_aura?: RewardItem | null;
  equipped_emotion?: RewardItem | null;
  equipped_title?: RewardItem | null;
};

export type StreakConfigItem = {
  day_number: number;
  reward_id: string;
  created_at: string;
  reward?: RewardItem;
  is_claimed?: boolean;
  is_available?: boolean;
};

export type StreakStats = {
  currentStreak: number;
  maxStreak: number;
  completedToday: boolean;
  lastCompletedAt: string | null;
};

export type StreakLeaderboardEntry = {
  rank: number;
  user_id: string;
  current_streak: number;
  max_streak: number;
  is_current_user: boolean;
};

export type CustomPhysicalPrize = {
  title: string;
  text: string;
  image_url?: string | null;
};

export type PromocodeRewardsBundle = {
  reward_ids?: string[];
  specific_material_ids?: string[];
  material_choice_count?: number;
  custom_physical?: CustomPhysicalPrize | null;
};

export type PromocodeItem = {
  id: string;
  code: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: string | null;
  rewards_bundle: PromocodeRewardsBundle;
  created_at: string;
};

export type PromocodeRedemption = {
  id: string;
  promocode_id: string;
  user_id: string;
  chosen_material_ids: string[];
  redeemed_at: string;
  promocode_code?: string;
  user_email?: string;
  user_full_name?: string;
};

export type PromocodeRedeemResult = {
  success: boolean;
  error?: string;
  requiresMaterialChoice?: boolean;
  remainingMaterialChoices?: number;
  grantedRewards?: RewardItem[];
  physicalPrize?: CustomPhysicalPrize | null;
  grantedMaterialIds?: string[];
};

export type UserPromocodeHistoryItem = {
  id: string;
  code: string;
  redeemed_at: string;
  granted_reward_titles?: string[];
  granted_material_titles?: string[];
  physical_prize?: CustomPhysicalPrize | null;
};