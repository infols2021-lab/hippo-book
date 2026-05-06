"use client";

import { useRouter } from "next/navigation";

type Props = {
  className?: string;
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

  async function run() {
    if (confirm) {
      const ok = window.confirm("Вы уверены, что хотите выйти?");
      if (!ok) return;
    }

    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
    }).catch(() => null);

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <button className={className} onClick={() => void run()} type="button">
      {children}
    </button>
  );
}