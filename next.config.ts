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
  // Yandex Object Storage – для загрузки через <Image> и обычных <img>
  return [
    {
      protocol: "https" as const,
      hostname: "storage.yandexcloud.net",
    },
  ];
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    remotePatterns: [
      ...(getSupabaseRemotePatterns() ?? []),
      ...(getYandexRemotePatterns() ?? []),
    ],
  },

  // Увеличение лимита тела запроса НЕ задаётся через next.config в App Router.
  // Для поддержки больших файлов (аудио) используйте клиентскую загрузку через
  // presigned URL в Supabase/Yandex, либо настройте обратный прокси (Nginx).
  // В коде уже реализована прямая загрузка в Storage (lib/storage/server.ts).

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