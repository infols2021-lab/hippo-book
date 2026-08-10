import { createSupabaseServerClient } from "@/lib/supabase/server";
import AssignmentClient from "@/app/(app)/projects/[slug]/assignment/AssignmentClient";
import Link from "next/link";

export const revalidate = 0;

export default async function DemoPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Находим активный демо-материал
  const { data: material } = await supabase
    .from("materials")
    .select("id, title")
    .eq("is_demo", true)
    .eq("is_active", true)
    .maybeSingle();

  if (!material) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-2xl font-bold mb-2">Демо-задание пока не доступно</h1>
        <p className="text-slate-400 max-w-md mb-6">Администратор еще не выделил демо-материал в системе.</p>
        <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all">
          ← Вернуться на страницу входа
        </Link>
      </div>
    );
  }

  // 2. Достаем первое задание демо-материала
  const { data: assignments } = await supabase
    .from("assignments")
    .select("id")
    .or(`material_id.eq.${material.id},textbook_id.eq.${material.id},crossword_id.eq.${material.id}`)
    .order("order_index", { ascending: true })
    .limit(1);

  const firstAssignment = assignments?.[0];

  if (!firstAssignment) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="text-6xl mb-4">📝</div>
        <h1 className="text-2xl font-bold mb-2">Демо-материал пуст</h1>
        <p className="text-slate-400 max-w-md mb-6">В демо-материале пока нет созданных заданий.</p>
        <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all">
          ← Вернуться на страницу входа
        </Link>
      </div>
    );
  }

  // 3. Запускаем оригинальный интерфейс задания в гостевом режиме
  return (
    <AssignmentClient 
      assignmentId={firstAssignment.id} 
      projectSlug="demo" 
      guestMode={true} 
    />
  );
}