// middleware.ts
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
  "/projects", // ✅ Фаза 0 — защита динамических страниц веток
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (needsAuth && !user) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|info/|login|register|reset|update-password).*)"
  ],
};