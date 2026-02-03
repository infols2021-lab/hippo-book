import AssignmentClient from "../AssignmentClient";

export default async function AssignmentByIdPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ source?: string; sourceId?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  return <AssignmentClient assignmentId={id} source={sp.source ?? ""} sourceId={sp.sourceId ?? ""} />;
}
