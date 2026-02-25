import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import ProfileClient, { type StreakSnapshot } from "./ProfileClient";

function normalizeStreakSnapshot(input: any): StreakSnapshot | null {
  if (!input || typeof input !== "object") return null;

  return {
    today: typeof input.today === "string" ? input.today : "",
    raw_current_streak: Number.isFinite(input.raw_current_streak) ? Number(input.raw_current_streak) : 0,
    display_current_streak: Number.isFinite(input.display_current_streak) ? Number(input.display_current_streak) : 0,
    longest_streak: Number.isFinite(input.longest_streak) ? Number(input.longest_streak) : 0,
    last_completed_date:
      typeof input.last_completed_date === "string" ? input.last_completed_date : input.last_completed_date ?? null,
    done_today: Boolean(input.done_today),
    can_save_today: Boolean(input.can_save_today),
    tier_code: typeof input.tier_code === "string" ? input.tier_code : "none",
  };
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: background },
    { data: streakRpcData, error: streakRpcError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, contact_phone, region, is_admin")
      .eq("id", user.id)
      .single(),
    supabase
      .from("backgrounds")
      .select("image_url, file_name, mime_type")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("get_my_streak_snapshot"),
  ]);

  // Не валим страницу, если RPC временно не сработал
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