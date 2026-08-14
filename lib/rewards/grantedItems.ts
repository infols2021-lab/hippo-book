import type { SupabaseClient } from "@supabase/supabase-js";

export type GrantedDisplayItem = {
  id: string;
  title: string;
  type: string;
  description?: string | null;
  asset_url?: string | null;
  meta?: Record<string, unknown>;
};

type MaterialRow = {
  id: string;
  title?: string | null;
  cover_image_url?: string | null;
};

export async function fetchMaterialsAsGrantedItems(
  supabase: SupabaseClient,
  materialIds: string[],
  description = "Разблокированный материал"
): Promise<GrantedDisplayItem[]> {
  const uniqueIds = Array.from(new Set(materialIds.map(String).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const [
    { data: materials },
    { data: textbooks },
    { data: crosswords },
  ] = await Promise.all([
    supabase.from("materials").select("id, title, cover_image_url").in("id", uniqueIds),
    supabase.from("textbooks").select("id, title, cover_image_url").in("id", uniqueIds),
    supabase.from("crosswords").select("id, title, cover_image_url").in("id", uniqueIds),
  ]);

  const map = new Map<string, { title: string; asset_url: string | null; type: string }>();

  const ingest = (rows: MaterialRow[] | null, type: string) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const id = String(row.id);
      if (!id || map.has(id)) continue;
      map.set(id, {
        title: String(row.title || "Материал"),
        asset_url: row.cover_image_url ?? null,
        type,
      });
    }
  };

  ingest(materials, "material");
  ingest(textbooks, "textbook");
  ingest(crosswords, "crossword");

  return uniqueIds.map((id) => {
    const info = map.get(id);
    return {
      id,
      title: info?.title || "Материал",
      type: info?.type || "material",
      description,
      asset_url: info?.asset_url ?? null,
    };
  });
}

export function mapRewardsToGrantedItems(
  rewards: Array<{
    id: string;
    title: string;
    type: string;
    description?: string | null;
    asset_url?: string | null;
    meta?: Record<string, unknown>;
  }>,
  description = "Награда по промокоду"
): GrantedDisplayItem[] {
  return rewards.map((reward) => ({
    id: reward.id,
    title: reward.title,
    type: reward.type,
    description: reward.description || description,
    asset_url: reward.asset_url ?? null,
    meta: reward.meta,
  }));
}
