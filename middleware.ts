import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

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
  "/projects",
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(req, res);

  // ВАЖНО: Вызов getUser() здесь критичен. 
  // Если пользователь переходит по ссылке из письма с параметром ?code=...
  // Supabase перехватит его, обменяет на токен и запишет cookie авторизации.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Защита приватных роутов
  if (needsAuth && !user) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Если юзер уже залогинен и пытается зайти на страницы входа/регистрации — кидаем в портал
  if (user && (pathname === "/login" || pathname === "/register" || pathname === "/reset")) {
    const portalUrl = new URL("/portal", req.url);
    return NextResponse.redirect(portalUrl);
  }

  return res;
}

export const config = {
  // ИСПРАВЛЕНИЕ: Убрали исключения для страниц login, register, reset, update-password.
  // Теперь middleware работает на них, чтобы Supabase успевал обработать токены в URL.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|info/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ],
};