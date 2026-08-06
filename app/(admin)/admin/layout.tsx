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
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --project-bg: #f8fafc;
          --project-text: #0f172a;
          --project-card-bg: #ffffff;
          --project-input-bg: #ffffff;
          --project-input-text: #0f172a;
          --project-input-border: #cbd5e1;
          --project-primary: #0ea5e9;
          
          --glass-border: #e2e8f0;
          --glass-shadow: 0 10px 30px rgba(0,0,0,0.08);
        }
      `}} />
      <div className="admin-root min-h-screen">
        <div className="admin-container">{children}</div>
      </div>
    </>
  );
}