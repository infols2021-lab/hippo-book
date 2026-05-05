import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PortalClient from "./PortalClient";

export default async function PortalPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .single();

  return (
    <PortalClient
      userName={profile?.full_name ?? ""}
      userEmail={user.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
    />
  );
}