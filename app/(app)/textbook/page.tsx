import { redirect } from "next/navigation";

export default async function TextbookRedirectPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const id = searchParams?.id;
  if (id) redirect(`/textbook/${id}`);
  redirect("/materials");
}
