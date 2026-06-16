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

  // Красивый Tailwind-экран ошибки соединения
  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-3xl p-8 text-center shadow-xl border border-gray-100 animate-in zoom-in-95 duration-300">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Проблема с соединением</h2>
          <p className="text-gray-500 mb-8">
            Не удалось связаться с сервером для проверки вашей сессии. Пожалуйста, проверьте подключение к интернету.
          </p>
          
          <div className="flex flex-col gap-3">
            <a 
              href="" 
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              🔄 Повторить попытку
            </a>
            <a 
              href="/login" 
              className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
            >
              ← Вернуться на страницу входа
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!hasUser) {
    redirect("/login");
  }

  return <>{children}</>;
}