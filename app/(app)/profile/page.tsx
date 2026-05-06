import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDataAuthContext } from "@/lib/data/auth";
import ProfileClient, { type StreakSnapshot } from "./ProfileClient";

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStreakSnapshot(input: any): StreakSnapshot | null {
  if (!input || typeof input !== "object") return null;

  return {
    today: typeof input.today === "string" ? input.today : "",
    raw_current_streak: asNumber(input.raw_current_streak, 0),
    display_current_streak: asNumber(input.display_current_streak, 0),
    longest_streak: asNumber(input.longest_streak, 0),
    last_completed_date:
      typeof input.last_completed_date === "string" ? input.last_completed_date : input.last_completed_date ?? null,
    done_today: Boolean(input.done_today),
    can_save_today: Boolean(input.can_save_today),
    tier_code: typeof input.tier_code === "string" ? input.tier_code : "none",
  };
}

export default async function ProfilePage() {
  const auth = await getDataAuthContext();

  if (!auth.ok) {
    if (auth.error.status === 401) redirect("/login");
    throw new Error(auth.error.message);
  }

  const { user } = auth.ctx;

  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: background }, { data: streakRpcData, error: streakRpcError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, contact_phone, region, is_admin")
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("backgrounds")
        .select("image_url, file_name, mime_type")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase.rpc("get_my_streak_snapshot"),
    ]);

  const initialStreak = streakRpcError ? null : normalizeStreakSnapshot(streakRpcData);

  return (
    <ProfileClient
      userEmail={user.email ?? ""}
      userId={user.id}
      initialProfile={{
        full_name: profile?.full_name ?? "",
        contact_phone: profile?.contact_phone ?? "",
        region: profile?.region ?? "",
        is_admin: Boolean(profile?.is_admin),
      }}
      backgroundUrl={background?.image_url ?? null}
      stats={null}
      materialsProgress={null}
      streak={initialStreak}
      equippedTitleLabel={null}
    />
  );
}