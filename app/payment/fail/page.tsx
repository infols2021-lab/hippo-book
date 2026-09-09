// app/payment/fail/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Оплата не прошла — skilLS",
};

export default function PaymentFailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-amber-100 mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-8 h-8 text-amber-600"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-center mb-2">Оплата не прошла</h1>
        <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
          Возможно, вы отменили платёж или произошла ошибка — деньги не списаны. Попробуйте ещё
          раз или напишите в поддержку.
        </p>

        <Link
          href="/portal"
          className="block w-full text-center bg-slate-900 text-white font-extrabold rounded-xl py-3 hover:opacity-90"
        >
          Вернуться к заявкам
        </Link>
        <Link
          href="/info/contacts"
          className="block w-full text-center text-slate-400 font-bold text-sm mt-3 hover:text-slate-600"
        >
          Написать в поддержку
        </Link>
      </div>
    </main>
  );
}
