// app/sitemap.ts
import type { MetadataRoute } from "next";

const BASE_URL = "https://hipposha-book.ru";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/demo",
  "/info",
  "/info/pricing",
  "/info/contacts",
  "/info/documents",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
