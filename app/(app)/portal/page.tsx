import { redirect } from "next/navigation";
import { getDataAuthContext } from "@/lib/data/auth";
import PortalClient from "./PortalClient";

export default async function PortalPage() {
  const auth = await getDataAuthContext();

  if (!auth.ok) {
    if (auth.error.status === 401) {
      redirect("/login");
    }

    throw new Error(auth.error.message);
  }

  const { user, profile } = auth.ctx;

  return (
    <PortalClient
      userName={profile?.full_name ?? ""}
      userEmail={user.email ?? profile?.email ?? ""}
      isAdmin={Boolean(profile?.is_admin)}
    />
  );
}