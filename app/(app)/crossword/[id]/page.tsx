import CrosswordClient from "../CrosswordClient";

export default async function CrosswordByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CrosswordClient crosswordId={id} initialData={null} />;
}
