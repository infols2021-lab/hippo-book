import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getSession();

    if (!data.session) redirect("/login");
    return <>{children}</>;
  } catch {
    return (
      <div className="container">
        <div className="card">
          <h2>⚠️ Проблема с соединением</h2>
          <p className="small-muted">Не удалось проверить сессию. Попробуйте обновить страницу.</p>

          <a className="btn" href="">
            🔄 Повторить
          </a>
          <div style={{ height: 10 }} />
          <a className="btn secondary" href="/login">
            ← На вход
          </a>
        </div>
      </div>
    );
  }
}
