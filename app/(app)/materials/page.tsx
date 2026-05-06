import { redirect } from "next/navigation";
import { getDataAuthContext } from "@/lib/data/auth";
import MaterialsClient from "./MaterialsClient";

export default async function MaterialsPage() {
  const auth = await getDataAuthContext();

  if (!auth.ok) {
    if (auth.error.status === 401) redirect("/login");
    throw new Error(auth.error.message);
  }

  return <MaterialsClient initialData={null} />;
}