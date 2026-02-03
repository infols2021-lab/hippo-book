"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  className?: string; // например "btn secondary"
  label?: string; // текст кнопки
  fallbackHref?: string; // если нет source
};

const INFO_STORAGE_KEY = "infoBackTarget:v1";

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

  // ✅ Для /info сохраняем "куда возвращаться" (login/profile) и используем потом,
  // чтобы "Назад" не прыгал по history на /info/pricing и т.д.
  useEffect(() => {
    if (!isInfoSection) return;

    const source = (sp.get("source") || "").trim().toLowerCase();
    const next =
      source === "login" ? "/login" :
      source === "profile" ? "/profile" :
      null;

    try {
      if (next) {
        sessionStorage.setItem(INFO_STORAGE_KEY, next);
        setInfoPersistedTarget(next);
      } else {
        const saved = sessionStorage.getItem(INFO_STORAGE_KEY);
        setInfoPersistedTarget(saved || null);
      }
    } catch {
      setInfoPersistedTarget(null);
    }
  }, [isInfoSection, sp]);

  const explicitTarget = useMemo(() => {
    const source = (sp.get("source") || "").trim().toLowerCase();
    const sourceId = (sp.get("sourceId") || "").trim();

    // ✅ инфо-страницы
    if (source === "login") return "/login";
    if (source === "profile") return "/profile";

    // существующая логика
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

    // 2) для /info: НЕ делаем router.back(), чтобы не возвращало на /info/pricing и т.д.
    if (isInfoSection) {
      router.push(fallbackHref);
      return;
    }

    // 3) для остальных страниц — оставляем старое поведение
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button className={className} onClick={handleClick} type="button">
      {label}
    </button>
  );
}
