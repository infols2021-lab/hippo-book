// app/sitemap.ts
import type { MetadataRoute } from "next";

const BASE_URL = "https://hipposha-book.ru";

const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/olympiads/hippo", priority: 0.9 },
  { path: "/exams/gatehouse-awards", priority: 0.9 },
  { path: "/login", priority: 0.8 },
  { path: "/register", priority: 0.8 },
  { path: "/demo", priority: 0.8 },
  { path: "/info", priority: 0.8 },
  { path: "/info/pricing", priority: 0.8 },
  { path: "/info/contacts", priority: 0.8 },
  { path: "/info/documents", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map(({ path, priority }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority,
  }));
}
