"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  className?: string; // "btn secondary"
  children?: React.ReactNode;
  confirm?: boolean;
  redirectTo?: string;
};

export default function LogoutButton({
  className = "btn secondary",
  children = "🚪 Выйти",
  confirm = true,
  redirectTo = "/login",
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  async function run() {
    if (confirm) {
      const ok = window.confirm("Вы уверены, что хотите выйти?");
      if (!ok) return;
    }

    await supabase.auth.signOut();
    router.push(redirectTo);
  }

  return (
    <button className={className} onClick={() => void run()} type="button">
      {children}
    </button>
  );
}
