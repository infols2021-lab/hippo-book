import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function GatehousePage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/login");
  }

  redirect("/gatehouse/profile");
}