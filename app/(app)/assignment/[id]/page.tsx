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

  // ✅ разрешаем только то, что реально используем в навигации
  const allowed = new Set(["textbook", "crossword", "materials", "login", "profile"]);
  return allowed.has(s) ? s : undefined;
}

export default async function AssignmentByIdPage({
  params,
  searchParams,
}: {
  params: MaybePromise<{ id: string }>;
  searchParams?: MaybePromise<SearchParams>;
}) {
  // ✅ await безопасен и для Promise, и для обычного объекта
  const p = await params;
  const sp = (await searchParams) ?? {};

  const assignmentId = String(p?.id ?? "").trim();

  const source = normSource(first(sp["source"]));
  const sourceId = normStr(first(sp["sourceId"]));

  return <AssignmentClient assignmentId={assignmentId} source={source} sourceId={sourceId} />;
}
