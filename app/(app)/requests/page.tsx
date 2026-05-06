import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDataAuthContext } from "@/lib/data/auth";
import RequestsClient from "./RequestsClient";

type PurchaseRequest = {
  id: string;
  request_number: string;
  created_at: string;
  class_level: string;
  textbook_types: string[] | null;
  email: string;
  full_name: string;
  is_processed: boolean;
  user_id: string;
  branch_type?: string | null;
};

export default async function RequestsPage() {
  const auth = await getDataAuthContext();

  if (!auth.ok) {
    if (auth.error.status === 401) redirect("/login");
    throw new Error(auth.error.message);
  }

  const { user } = auth.ctx;

  const supabase = await createSupabaseServerClient();

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),

    supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", user.id)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <RequestsClient
      userId={user.id}
      userEmail={user.email ?? ""}
      userFullName={profile?.full_name ?? ""}
      initialRequests={(requests ?? []) as PurchaseRequest[]}
    />
  );
}