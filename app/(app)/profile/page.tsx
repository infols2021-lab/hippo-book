import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [{ data: profile }, { data: background }] = await Promise.all([
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
  ]);

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
    />
  );
}
