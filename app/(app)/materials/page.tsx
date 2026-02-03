import MaterialsClient from "./MaterialsClient";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MaterialsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();

  if (!data.session) redirect("/login");

  // Ничего тяжелого не грузим тут — быстро отдаём UI
  return <MaterialsClient initialData={null} />;
}
