import "server-only";

import { unstable_cache, revalidateTag } from "next/cache";

export const DATA_CACHE_TAGS = {
  PROFILE: "profile",
  OLYMPIAD_MATERIALS: "olympiad-materials",
  GATEHOUSE_MATERIALS: "gatehouse-materials",
  ASSIGNMENTS: "assignments",
  REQUESTS: "requests",
  STORAGE: "storage",
} as const;

export const DEFAULT_CACHE_SECONDS = 60;
export const SHORT_CACHE_SECONDS = 15;
export const LONG_CACHE_SECONDS = 300;

type CacheOptions = {
  key: string[];
  tags?: string[];
  revalidate?: number;
};

function normalizeKeyParts(parts: string[]) {
  return parts.map((part) => String(part || "").trim()).filter(Boolean);
}

export function cachedData<T>(options: CacheOptions, loader: () => Promise<T>) {
  return unstable_cache(loader, normalizeKeyParts(options.key), {
    revalidate: options.revalidate ?? DEFAULT_CACHE_SECONDS,
    tags: options.tags ?? [],
  })();
}

export function cachedPublicData<T>(
  key: string[],
  loader: () => Promise<T>,
  tags: string[] = [],
) {
  return cachedData(
    {
      key,
      tags,
      revalidate: LONG_CACHE_SECONDS,
    },
    loader,
  );
}

export function cachedShortData<T>(
  key: string[],
  loader: () => Promise<T>,
  tags: string[] = [],
) {
  return cachedData(
    {
      key,
      tags,
      revalidate: SHORT_CACHE_SECONDS,
    },
    loader,
  );
}

export function revalidateDataTag(tag: string) {
  revalidateTag(tag, "max");
}

export function revalidateUserData(userId: string) {
  const id = String(userId || "").trim();
  if (!id) return;

  revalidateTag(`${DATA_CACHE_TAGS.PROFILE}:${id}`, "max");
  revalidateTag(`${DATA_CACHE_TAGS.REQUESTS}:${id}`, "max");
  revalidateTag(`${DATA_CACHE_TAGS.ASSIGNMENTS}:${id}`, "max");
}

export function profileCacheTag(userId: string) {
  return `${DATA_CACHE_TAGS.PROFILE}:${userId}`;
}

export function requestsCacheTag(userId: string) {
  return `${DATA_CACHE_TAGS.REQUESTS}:${userId}`;
}

export function assignmentsCacheTag(userId: string) {
  return `${DATA_CACHE_TAGS.ASSIGNMENTS}:${userId}`;
}

export function gatehouseMaterialsCacheTag() {
  return DATA_CACHE_TAGS.GATEHOUSE_MATERIALS;
}

export function olympiadMaterialsCacheTag() {
  return DATA_CACHE_TAGS.OLYMPIAD_MATERIALS;
}