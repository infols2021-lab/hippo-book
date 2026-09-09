// app/payment/success/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Оплата прошла — skilLS",
};

export default function PaymentSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200">
        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-slate-100 mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-7 h-7 text-slate-600"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Оплата прошла успешно</h1>
        <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
          Доступ к выбранным материалам открывается автоматически сразу после подтверждения
          оплаты. Если доступ не открылся в течение нескольких минут, обратитесь в службу
          технической поддержки.
        </p>

        <Link
          href="/portal"
          className="block w-full text-center bg-slate-900 text-white font-semibold rounded-xl py-3 hover:bg-slate-800 transition-colors"
        >
          Перейти в кабинет
        </Link>
        <Link
          href="/"
          className="block w-full text-center text-slate-400 font-semibold text-sm mt-3 hover:text-slate-600"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
