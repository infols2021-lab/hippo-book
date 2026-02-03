import TextbookClient from "../TextbookClient";

export default async function TextbookByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TextbookClient textbookId={id} initialData={null} />;
}
