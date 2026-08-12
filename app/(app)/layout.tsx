// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TourProvider } from "@/components/tour/TourProvider";
import ProductTour from "@/components/tour/ProductTour";
import TourResumeBootstrap from "@/components/tour/TourResumeBootstrap";
import { TourStage, normalizeTourStage } from "@/lib/tour/tourConfig";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let connectionError = false;
  let hasUser = false;
  let initialTourStage: TourStage = "finished";

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
      
      if (data.user) {
        // Подтягиваем стадию тура из профиля
        const { data: profile } = await supabase
          .from("profiles")
          .select("has_seen_tour, tour_stage")
          .eq("id", data.user.id)
          .single();

        if (profile) {
          const normalized = normalizeTourStage(profile.tour_stage);
          if (normalized && normalized !== "finished") {
            initialTourStage = normalized;
          } else if (profile.has_seen_tour === false) {
            initialTourStage = "portal_intro";
          }
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
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Проблема с соединением</h2>
          <p className="text-gray-500 mb-8">Не удалось проверить сессию. Проверь интернет или сервер.</p>
          <div className="flex flex-col gap-3">
            <a href="/portal" className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl">🔄 Повторить</a>
            <a href="/login" className="w-full py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl">← Войти</a>
          </div>
        </div>
      </div>
    );
  }

  if (!hasUser) {
    redirect("/login");
  }

  return (
    <TourProvider initialStage={initialTourStage}>
      {children}
      <TourResumeBootstrap />
      <ProductTour />
    </TourProvider>
  );
}