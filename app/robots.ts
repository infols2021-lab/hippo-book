// app/robots.ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/portal", "/api", "/projects/", "/materials/"],
      },
    ],
    sitemap: "https://hipposha-book.ru/sitemap.xml",
  };
}
