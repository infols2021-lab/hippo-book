import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

/**
 * Роуты, требующие авторизации.
 * Незалогиненный пользователь → редирект на /login
 */
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

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // Обновляем сессионные куки Supabase на каждом запросе.
  // Без этого JWT истекает и пользователя выбивает.
  const supabase = createSupabaseMiddlewareClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return res;
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