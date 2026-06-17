import AssignmentClient from "../AssignmentClient";

type MaybePromise<T> = T | Promise<T>;
type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normStr(v: string | undefined) {
  const s = (v ?? "").trim();
  return s.length ? s : undefined;
}

function normSource(v: string | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return undefined;

  const allowed = new Set([
    "textbook",
    "crossword",
    "materials",
    "login",
    "profile",
    "gatehouse-material",
    "gatehouse",
  ]);

  return allowed.has(s) ? s : undefined;
}

export default async function AssignmentByIdPage({
  params,
  searchParams,
}: {
  // 🔥 ИСПРАВЛЕНИЕ 1: Добавили slug в типы
  params: MaybePromise<{ slug: string; id: string }>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  const p = await params;
  const sp = (await searchParams) ?? {};

  const assignmentId = String(p?.id ?? "").trim();
  
  // 🔥 ИСПРАВЛЕНИЕ 2: Достаем slug из URL
  const slug = String(p?.slug ?? "").trim();

  const source = normSource(first(sp["source"]));
  const sourceId = normStr(first(sp["sourceId"]));

  // 🔥 ИСПРАВЛЕНИЕ 3: Передаем projectSlug
  return (
    <AssignmentClient 
      assignmentId={assignmentId} 
      source={source} 
      sourceId={sourceId} 
      projectSlug={slug} 
    />
  );
}