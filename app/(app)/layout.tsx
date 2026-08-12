// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ProductTour from "@/components/tour/ProductTour";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let connectionError = false;
  let hasUser = false;
  let needsTour = false; // Флаг для запуска тура

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const msg = String(error.message || "").toLowerCase();

      const isSessionIssue =
        msg.includes("auth session missing") ||
        msg.includes("session missing") ||
        msg.includes("jwt") ||
        msg.includes("invalid token");

      if (isSessionIssue) {
        hasUser = false;
      } else {
        connectionError = true;
      }
    } else {
      hasUser = Boolean(data.user);
      
      // Если юзер авторизован, проверяем проходил ли он обучение
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("has_seen_tour")
          .eq("id", data.user.id)
          .single();

        // Запускаем тур, только если поле строго равно false
        if (profile && profile.has_seen_tour === false) {
          needsTour = true;
        }
      }
    }
  } catch {
    connectionError = true;
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-3xl p-8 text-center shadow-xl border border-gray-100">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            Проблема с соединением
          </h2>
          <p className="text-gray-500 mb-8">
            Не удалось проверить сессию. Проверь интернет или сервер.
          </p>

          <div className="flex flex-col gap-3">
            <a
              href="/portal"
              className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl"
            >
              🔄 Повторить
            </a>
            <a
              href="/login"
              className="w-full py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl"
            >
              ← Войти
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!hasUser) {
    redirect("/login");
  }

  return (
    <>
      {children}
      {/* Рендерим тур глобально для всего портала */}
      <ProductTour initialRun={needsTour} />
    </>
  );
}