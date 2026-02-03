"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  className?: string;
  label?: string;
  fallbackHref?: string;
};

const INFO_STORAGE_KEY = "infoBackTarget:v1";

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
  fallbackHref = "/login",
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() || "";

  const isInfoSection = pathname === "/info" || pathname.startsWith("/info/");
  const [persistedTarget, setPersistedTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!isInfoSection) return;

    const source = (sp.get("source") || "").trim().toLowerCase();
    const next = source === "login" ? "/login" : source === "profile" ? "/profile" : null;

    if (next) {
      safeSet(INFO_STORAGE_KEY, next);
      setPersistedTarget(next);
    } else {
      setPersistedTarget(safeGet(INFO_STORAGE_KEY));
    }
  }, [isInfoSection, sp]);

  const target = useMemo(() => {
    if (!isInfoSection) return null;
    const source = (sp.get("source") || "").trim().toLowerCase();
    if (source === "login") return "/login";
    if (source === "profile") return "/profile";
    return persistedTarget || null;
  }, [isInfoSection, sp, persistedTarget]);

  function handleClick() {
    if (!isInfoSection) {
      // Этот компонент теперь не должен использоваться вне /info
      router.push(fallbackHref);
      return;
    }
    router.push(target || fallbackHref);
  }

  return (
    <button className={className} onClick={handleClick} type="button">
      {label}
    </button>
  );
}
