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
      {/* ЖЕСТКИЙ ПЕРЕХВАТ ТЕМЫ ДЛЯ АДМИНКИ И ЕЁ МОДАЛОК */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --project-bg: #f1f5f9;
          --project-text: #0f172a;
          --project-card-bg: #ffffff;
          
          /* Светлые красивые инпуты */
          --project-input-bg: #ffffff;
          --project-input-text: #0f172a;
          --project-input-border: #cbd5e1;
          
          --project-primary: #0ea5e9;
          --project-secondary: #0284c7;
          
          /* Убираем стекло в админке, делаем чисто белым */
          --glass-bg: #ffffff;
          --glass-border: #e2e8f0;
          --glass-highlight: transparent;
          --glass-shadow: 0 10px 30px rgba(0,0,0,0.08);
          --glass-blur: blur(0px);
        }
        body { background-color: var(--project-bg); color: var(--project-text); }
      `}} />
      <div className="admin-root">
        <div className="admin-container">{children}</div>
      </div>
    </>
  );
}