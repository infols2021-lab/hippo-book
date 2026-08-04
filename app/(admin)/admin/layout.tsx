import "@/public/styles/base.css";
import "./admin.css";

import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/api/admin";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requireAdmin();

  if ("response" in auth) {
    redirect("/login");
  }

  return (
    <div className="admin-root">
      <div className="admin-container">{children}</div>
    </div>
  );
}