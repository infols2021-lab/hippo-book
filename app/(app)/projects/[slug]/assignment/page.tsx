import AssignmentClient from "./AssignmentClient";

export const revalidate = 0;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
};

export default async function AssignmentPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { id } = await searchParams;

  if (!id) {
    return <div style={{ padding: 50, textAlign: "center" }}>Ошибка: ID задания не передан</div>;
  }

  // Передаем параметры из URL в твой клиентский компонент
  return <AssignmentClient assignmentId={id} projectSlug={slug} />;
}