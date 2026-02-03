import { createSupabaseServerClient } from "../../../lib/supabase/server";
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
};

export default async function RequestsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) return null;

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", user.id)
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
