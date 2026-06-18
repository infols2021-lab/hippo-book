import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Роуты, требующие авторизации
const PROTECTED_PREFIXES = [
  "/portal",
  "/profile",
  "/assignment",
  "/textbook",
  "/materials",
  "/crossword",
  "/gatehouse",
  "/requests",
  "/admin",
];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Современный и надежный способ инициализации Supabase в мидлваре
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ❗️ ВАЖНО: Этот вызов "пробуждает" сессию и заставляет Supabase обновить куки
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Проверяем, требует ли текущий путь авторизации
  const needsAuth = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // Если путь защищен, а пользователя нет (или куки протухли) — отправляем на логин
  if (needsAuth && !user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Матчим всё кроме:
     * - _next/static  (статика Next.js)
     * - _next/image   (оптимизация картинок)
     * - favicon.ico
     * - /api/         (API-роуты проверяют сессию сами)
     * - /info/        (публичные страницы)
     * - /login, /register, /reset, /update-password
     */
    "/((?!_next/static|_next/image|favicon\\.ico|api/|info/|login|register|reset|update-password).*)",
  ],
};