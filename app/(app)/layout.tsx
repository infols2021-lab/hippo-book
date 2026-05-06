import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let hasUser = false;
  let connectionError = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const msg = String(error.message || "").toLowerCase();

      if (
        msg.includes("auth session missing") ||
        msg.includes("session missing") ||
        msg.includes("jwt") ||
        msg.includes("invalid token")
      ) {
        hasUser = false;
      } else {
        connectionError = true;
      }
    } else {
      hasUser = Boolean(data.user);
    }
  } catch {
    connectionError = true;
  }

  if (connectionError) {
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

  if (!hasUser) {
    redirect("/login");
  }

  return <>{children}</>;
}