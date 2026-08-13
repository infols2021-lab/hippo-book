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

  serverExternalPackages: ['sharp'],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // serverBodySizeLimit существует в рантайме Next.js 13.4.4+, но отсутствует
  // в типах старых версий пакета — поэтому приводим к any.
  // Без этого Next.js обрезает тело запроса на 4 МБ до попадания в route handler,
  // что даёт 413 на аудиофайлах ≥ 5 МБ.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  images: {
    remotePatterns: [
      ...(getSupabaseRemotePatterns() ?? []),
      ...(getYandexRemotePatterns() ?? []),
    ],
  },

  async redirects() {
    return [
      // 1. Твой старый фикс для HTML
      {
        source: "/:path*.html",
        destination: "/:path*",
        permanent: true,
      },
      
      // ==========================================
      // 2. РЕДИРЕКТЫ ДЛЯ ОЛИМПИАДЫ (Legacy Корневые)
      // ==========================================
      {
        source: "/materials",
        destination: "/projects/olympiad/materials",
        permanent: true, // 301 редирект для SEO и браузеров
      },
      {
        source: "/profile",
        destination: "/projects/olympiad/profile",
        permanent: true,
      },
      {
        source: "/requests",
        destination: "/projects/olympiad/requests",
        permanent: true,
      },
      // Умные редиректы для старых ссылок на задания Олимпиады
      {
        source: "/textbook/:id",
        destination: "/projects/olympiad/assignment/:id",
        permanent: true,
      },
      {
        source: "/crossword/:id",
        destination: "/projects/olympiad/assignment/:id",
        permanent: true,
      },

      // ==========================================
      // 3. РЕДИРЕКТЫ ДЛЯ GATEHOUSE AWARDS
      // ==========================================
      {
        source: "/gatehouse",
        destination: "/projects/gatehouse",
        permanent: true,
      },
      {
        source: "/gatehouse/materials",
        destination: "/projects/gatehouse/materials",
        permanent: true,
      },
      {
        source: "/gatehouse/profile",
        destination: "/projects/gatehouse/profile",
        permanent: true,
      },
      {
        source: "/gatehouse/requests",
        destination: "/projects/gatehouse/requests",
        permanent: true,
      },
      // Умный редирект для старых ссылок на тесты
      {
        source: "/gatehouse/assignment/:id",
        destination: "/projects/gatehouse/assignment/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;