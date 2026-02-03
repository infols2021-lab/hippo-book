import "@/public/styles/base.css";
import "./admin.css";

import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/api/admin";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requireAdmin();

  // requireAdmin у тебя возвращает либо { response }, либо { supabase, user }
  if ("response" in auth) {
    redirect("/login");
  }

  // В nested layout НЕ рендерим <html>/<body>, иначе можно сломать общий RootLayout.
  return <div className="admin-container">{children}</div>;
}
