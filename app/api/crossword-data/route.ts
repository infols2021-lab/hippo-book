import { NextResponse, type NextRequest } from "next/server";

export function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  return NextResponse.redirect(new URL(`/api/crossword-data/${encodeURIComponent(id)}`, req.url));
}
