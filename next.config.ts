// next.config.ts
import type { NextConfig } from "next";

function getSupabaseRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) return [];

  try {
    const url = new URL(rawUrl);
    if (!url.hostname) return [];

    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

function getYandexRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  return [
    {
      protocol: "https" as const,
      hostname: "storage.yandexcloud.net",
    },
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // serverBodySizeLimit существует в рантайме Next.js 13.4.4+, но отсутствует
  // в типах старых версий пакета — поэтому приводим к any.
  // Без этого Next.js обрезает тело запроса на 4 МБ до попадания в route handler,
  // что даёт 413 на аудиофайлах ≥ 5 МБ.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  experimental: {
    serverBodySizeLimit: "20mb",
  } as any,

  images: {
    remotePatterns: [
      ...(getSupabaseRemotePatterns() ?? []),
      ...(getYandexRemotePatterns() ?? []),
    ],
  },

  async redirects() {
    return [
      {
        source: "/:path*.html",
        destination: "/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;