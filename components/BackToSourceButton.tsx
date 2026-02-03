"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  className?: string;
  label?: string;
  fallbackHref?: string;
};

const INFO_STORAGE_KEY = "infoBackTarget:v1";
const LAST_SAFE_BACK_KEY = "lastSafeBackTarget:v1";

function safeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export default function BackToSourceButton({
  className = "btn secondary",
  label = "← Назад",
  fallbackHref = "/materials",
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() || "";

  const isInfoSection = pathname === "/info" || pathname.startsWith("/info/");

  const [infoPersistedTarget, setInfoPersistedTarget] = useState<string | null>(null);
  const [lastSafeTarget, setLastSafeTarget] = useState<string | null>(null);

  // ✅ запоминаем "безопасную" точку возврата
  // логика:
  // - если есть source/sourceId — строим родителя и сохраняем
  // - если мы на /materials — тоже сохраняем /materials
  // - для /info сохраняем только login/profile (как у тебя)
  useEffect(() => {
    // 1) /info — отдельная логика (как у тебя)
    if (isInfoSection) {
      const source = (sp.get("source") || "").trim().toLowerCase();
      const next =
        source === "login"
          ? "/login"
          : source === "profile"
            ? "/profile"
            : null;

      if (next) {
        safeSet(INFO_STORAGE_KEY, next);
        setInfoPersistedTarget(next);
      } else {
        setInfoPersistedTarget(safeGet(INFO_STORAGE_KEY));
      }
      return;
    }

    // 2) если /materials — это идеальная safe точка
    if (pathname === "/materials") {
      safeSet(LAST_SAFE_BACK_KEY, "/materials");
      setLastSafeTarget("/materials");
      return;
    }

    // 3) если есть явный source — сохраняем родителя
    const source = (sp.get("source") || "").trim().toLowerCase();
    const sourceId = (sp.get("sourceId") || "").trim();

    const target =
      source === "materials"
        ? "/materials"
        : source === "login"
          ? "/login"
          : source === "profile"
            ? "/profile"
            : source === "textbook" && sourceId
              ? `/textbook/${encodeURIComponent(sourceId)}`
              : source === "crossword" && sourceId
                ? `/crossword/${encodeURIComponent(sourceId)}`
                : null;

    if (target) {
      safeSet(LAST_SAFE_BACK_KEY, target);
      setLastSafeTarget(target);
      return;
    }

    // 4) если ничего не пришло — просто читаем что было сохранено
    setLastSafeTarget(safeGet(LAST_SAFE_BACK_KEY));
  }, [isInfoSection, pathname, sp]);

  const explicitTarget = useMemo(() => {
    const source = (sp.get("source") || "").trim().toLowerCase();
    const sourceId = (sp.get("sourceId") || "").trim();

    // ✅ инфо-страницы
    if (source === "login") return "/login";
    if (source === "profile") return "/profile";

    // ✅ материалы как source (если где-то будешь прокидывать)
    if (source === "materials") return "/materials";

    // ✅ существующая логика
    if (source === "textbook" && sourceId) return `/textbook/${encodeURIComponent(sourceId)}`;
    if (source === "crossword" && sourceId) return `/crossword/${encodeURIComponent(sourceId)}`;

    // ✅ если это /info и source нет, но мы ранее запомнили login/profile — используем
    if (isInfoSection && infoPersistedTarget) return infoPersistedTarget;

    return null;
  }, [sp, isInfoSection, infoPersistedTarget]);

  function handleClick() {
    // 1) если есть явная цель — идём туда
    if (explicitTarget) {
      router.push(explicitTarget);
      return;
    }

    // 2) для /info: НЕ делаем router.back()
    if (isInfoSection) {
      router.push(fallbackHref);
      return;
    }

    // 3) если нет source — идём в последний сохранённый “родитель”
    if (lastSafeTarget) {
      router.push(lastSafeTarget);
      return;
    }

    // 4) иначе — fallback
    router.push(fallbackHref);
  }

  return (
    <button className={className} onClick={handleClick} type="button">
      {label}
    </button>
  );
}
