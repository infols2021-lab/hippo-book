// app/payment/fail/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Оплата не завершена — skilLS",
};

type FailSearchParams = {
  project_slug?: string;
  order_num?: string;
};

export default async function PaymentFailPage({
  searchParams,
}: {
  searchParams?: Promise<FailSearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  const projectSlug = String(sp.project_slug || "").trim();
  const orderNum = String(sp.order_num || "").trim();

  const backHref = projectSlug
    ? `/projects/${projectSlug}/requests`
    : "/portal";

  return (
    <main className="min-h-screen flex items-center justify-center p-3 sm:p-4 overflow-x-hidden bg-slate-50">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200">
        <div className="w-14 h-14 mx-auto flex items-center justify-center rounded-full bg-slate-100 mb-5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-7 h-7 text-slate-500"
            aria-hidden="true"
          >
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-center mb-2">
          Оплата не была завершена
        </h1>
        <p className="text-sm text-slate-500 text-center leading-relaxed mb-4">
          Средства не были списаны. Вы можете повторить попытку оплаты или обратиться
          в службу технической поддержки, если возникли сложности.
        </p>

        {orderNum ? (
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center rounded-lg bg-slate-100 border border-slate-200 px-3 py-1.5 font-mono text-xs text-slate-600 tracking-wide">
              Заказ: {orderNum}
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={backHref}
            className="flex-1 block text-center bg-slate-900 text-white font-semibold rounded-xl py-3 px-4 hover:bg-slate-800 transition-colors"
          >
            Вернуться к заявкам
          </Link>
          <Link
            href="/info/contacts"
            className="flex-1 block text-center bg-white text-slate-700 font-semibold rounded-xl py-3 px-4 border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Служба поддержки
          </Link>
        </div>
      </div>
    </main>
  );
}

