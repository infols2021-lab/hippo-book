import type { Metadata } from "next";
import Link from "next/link";
import "./email-confirmed.css";

export const metadata: Metadata = {
  title: "Email подтверждён",
};

export default function EmailConfirmedPage() {
  return (
    <main className="page-confirmed">
      <div className="confirmed-container">
        <div className="confirmed-card">
          <div className="confirmed-icon" aria-hidden="true">
            <span className="confirmed-icon-bg" />
            <svg
              className="confirmed-check"
              viewBox="0 0 44 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M11 23 L19 31 L33 14" />
            </svg>
          </div>

          <h1 className="confirmed-title">Email подтверждён</h1>

          <p className="confirmed-subtitle">
            Регистрация завершена. Теперь вы можете войти на платформу.
          </p>

          <Link href="/login" className="confirmed-btn">
            Войти
          </Link>
        </div>
      </div>
    </main>
  );
}
