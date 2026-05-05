import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import GatehouseRequestsClient, {
  type GatehousePurchaseRequest,
  type GatehouseRequestProfile,
} from "./GatehouseRequestsClient";

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeRequest(row: any): GatehousePurchaseRequest {
  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    request_number: String(row?.request_number ?? ""),
    request_date: typeof row?.request_date === "string" ? row.request_date : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : "",
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
    branch_type: "gatehouse",
    class_level: typeof row?.class_level === "string" ? row.class_level : null,
    target_level: normalizeArray(row?.target_level),
    target_levels: normalizeArray(row?.target_levels),
    textbook_types: normalizeArray(row?.textbook_types),
    material_kinds: normalizeArray(row?.material_kinds),
    email: String(row?.email ?? ""),
    full_name: String(row?.full_name ?? ""),
    contact_phone: typeof row?.contact_phone === "string" ? row.contact_phone : null,
    is_processed: Boolean(row?.is_processed),
    processed_at: typeof row?.processed_at === "string" ? row.processed_at : null,
  };
}

export default async function GatehouseRequestsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileRow }, { data: requestRows, error: requestsError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, contact_phone, region")
      .eq("id", user.id)
      .single(),

    supabase
      .from("purchase_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("branch_type", "gatehouse")
      .order("created_at", { ascending: false }),
  ]);

  const profile: GatehouseRequestProfile = {
    id: user.id,
    email: String(profileRow?.email || user.email || ""),
    full_name: typeof profileRow?.full_name === "string" ? profileRow.full_name : "",
    contact_phone: typeof profileRow?.contact_phone === "string" ? profileRow.contact_phone : "",
    region: typeof profileRow?.region === "string" ? profileRow.region : "",
  };

  return (
    <GatehouseRequestsClient
      profile={profile}
      initialRequests={Array.isArray(requestRows) ? requestRows.map(normalizeRequest) : []}
      initialError={requestsError?.message ?? null}
    />
  );
}