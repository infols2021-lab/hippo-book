// app/payment/success/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Оплата прошла — skilLS",
};

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-8 shadow-2xl">
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-emerald-100 mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-8 h-8 text-emerald-600"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-center mb-2">Оплата прошла успешно</h1>
        <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
          Спасибо! Доступ к выбранным материалам откроется автоматически в течение пары минут
          после подтверждения платежа.
        </p>

        <Link
          href="/portal"
          className="block w-full text-center bg-slate-900 text-white font-extrabold rounded-xl py-3 hover:opacity-90"
        >
          Перейти в кабинет
        </Link>
        <Link
          href="/"
          className="block w-full text-center text-slate-400 font-bold text-sm mt-3 hover:text-slate-600"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
