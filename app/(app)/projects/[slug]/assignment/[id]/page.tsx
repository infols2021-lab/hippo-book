import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

// Тот самый, твой родной движок тестирования!
import AssignmentClient from "@/app/(app)/assignment/AssignmentClient";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ source?: string; sourceId?: string }>;
};

export default async function AssignmentPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const { slug, id: assignmentId } = await params;
  
  // Достаем параметры url 
  const sp = await searchParams;
  const source = sp?.source;
  const sourceId = sp?.sourceId;

  // Проверяем, существует ли проект и не скрыт ли он
  const { data: project } = await supabase
    .from("projects")
    .select("id, is_available")
    .eq("slug", slug)
    .single();

  if (!project || !project.is_available) notFound();

  // Мы больше не делаем запрос к таблице 'assignments' здесь,
  // потому что AssignmentClient сам сделает fetch внутри себя при монтировании!

  return (
    <AssignmentClient 
      assignmentId={assignmentId} 
      source={source} 
      sourceId={sourceId} 
    />
  );
}