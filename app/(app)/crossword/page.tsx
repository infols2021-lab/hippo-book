import { redirect } from "next/navigation";

export default async function CrosswordRedirectPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const id = searchParams?.id;
  if (id) redirect(`/crossword/${id}`);
  redirect("/materials");
}
