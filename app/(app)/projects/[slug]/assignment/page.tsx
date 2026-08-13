import AssignmentClient from "./AssignmentClient";

export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string; source?: string; sourceId?: string }>;
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
  const { id, source, sourceId } = await searchParams;

  if (!id) {
    return <div style={{ padding: 50, textAlign: "center" }}>Ошибка: ID задания не передан</div>;
  }

  return (
    <AssignmentClient
      assignmentId={id}
      projectSlug={slug}
      source={normSource(source)}
      sourceId={normStr(sourceId)}
    />
  );
}
