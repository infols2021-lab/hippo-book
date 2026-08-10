import { createSupabaseServerClient } from "@/lib/supabase/server";
import DemoClient from "@/app/demo/DemoClient";

export const revalidate = 0;

export default async function DemoPage() {
  const supabase = await createSupabaseServerClient();

  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("is_demo", true)
    .eq("is_active", true)
    .maybeSingle();

  let assignments: any[] = [];
  if (material) {
    const { data } = await supabase
      .from("assignments")
      .select("*")
      .or(`material_id.eq.${material.id},textbook_id.eq.${material.id},crossword_id.eq.${material.id}`)
      .order("order_index", { ascending: true });

    assignments = data || [];
  }

  return (
    <DemoClient 
      initialMaterial={material} 
      initialAssignments={assignments} 
    />
  );
}