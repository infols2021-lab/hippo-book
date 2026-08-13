import { createSupabaseServerClient } from "@/lib/supabase/server";
import AssignmentClient from "./AssignmentClient";

export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; source?: string; sourceId?: string; roadmapNode?: string }>;
};

function normStr(v: string | undefined) {
  const s = (v ?? "").trim();
  return s.length ? s : undefined;
}

function normSource(v: string | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return undefined;

  const allowed = new Set(["textbook", "crossword"]);
  return allowed.has(s) ? s : undefined;
}

export default async function AssignmentPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { id, source, sourceId, roadmapNode } = await searchParams;

  if (!id) {
    return <div style={{ padding: 50, textAlign: "center" }}>Ошибка: ID задания не передан</div>;
  }

  let isDemoMaterial = false;
  if (sourceId) {
    const supabase = await createSupabaseServerClient();
    const { data: material } = await supabase
      .from("materials")
      .select("is_demo")
      .eq("id", sourceId)
      .maybeSingle();
    isDemoMaterial = Boolean(material?.is_demo);
  }

  return (
    <AssignmentClient
      assignmentId={id}
      projectSlug={slug}
      source={normSource(source) ?? normStr(source)?.toLowerCase()}
      sourceId={normStr(sourceId)}
      isDemoMaterial={isDemoMaterial}
      roadmapNodeId={normStr(roadmapNode)}
    />
  );
}
