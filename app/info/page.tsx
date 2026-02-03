import Link from "next/link";
import BackToSourceButton from "@/components/BackToSourceButton";

type SP = { source?: string; sourceId?: string };

function lastDayOfCurrentMonthUTC(): Date {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0, 12, 0, 0));
}

function formatRuDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export const metadata = {
  title: "Информация",
  description: "Прайс, контакты и документы. Оплата по QR в заявке, доступ выдаём после проверки.",
};

function buildQs(sp: SP) {
  const q = new URLSearchParams();
  if (sp.source) q.set("source", sp.source);
  if (sp.sourceId) q.set("sourceId", sp.sourceId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function InfoPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const qs = buildQs(sp);

  const stamp = lastDayOfCurrentMonthUTC();

  return (
    <div className="info-wrap">
      <div className="info-shell">
        <section className="info-hero">
          <div className="info-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {/* Кнопка назад: решается через ?source=login|profile */}
              <BackToSourceButton className="back-link" label="← Назад" fallbackHref="/login" />


              <div className="info-badge" aria-label="Дата обновления">
                <span className="info-badge-dot" />
                <div className="info-badge-text">
                  <strong>Обновление страницы</strong>
                  <span>{formatRuDate(stamp)}</span>
                </div>
              </div>
            </div>

            <div className="info-note">
              Важно: оплата происходит через QR-код в заявке. Проверяем вручную и выдаём доступ обычно в течение 24 часов.
            </div>
          </div>

          <h1 className="info-title">Информация для участников</h1>
          <p className="info-subtitle">
            Здесь всё, чтобы было понятно: что можно купить, сколько стоит, как происходит оплата и когда выдаётся доступ.
          </p>

          <div className="info-grid">
            <div className="info-card">
              <h3>🧾 Как проходит оплата</h3>
              <p>
                В заявке генерируется QR-код. Вы оплачиваете по QR, затем мы вручную проверяем оплату в банке и выдаём доступ.
                Обычно это занимает до 24 часов.
              </p>
            </div>

            <div className="info-card">
              <h3>🧩 Что можно купить</h3>
              <p>
                В одной заявке можно купить <strong>1 учебник</strong> и <strong>1 кроссворд</strong>. Материалы выдаются
                автоматически под выбранный класс/уровень (после подтверждения оплаты).
              </p>
            </div>

            <div className="info-card">
              <h3>📮 Поддержка</h3>
              <p>
                Если прошло больше 24 часов — напишите в поддержку, указав почту и номер заявки. Мы поможем быстрее найти оплату.
              </p>
            </div>
          </div>

          {/* ✅ ВАЖНО: протаскиваем qs во все внутренние ссылки */}
          <div className="info-actions">
            <Link className="info-btn" href={`/info/pricing${qs}`}>
              <span>
                Прайс
                <br />
                <small>цены и правила покупки</small>
              </span>
              <span className="arrow">→</span>
            </Link>

            <Link className="info-btn" href={`/info/contacts${qs}`}>
              <span>
                Контакты
                <br />
                <small>почта и Telegram</small>
              </span>
              <span className="arrow">→</span>
            </Link>

            <Link className="info-btn" href={`/info/documents${qs}`}>
              <span>
                Документы
                <br />
                <small>пока заглушка</small>
              </span>
              <span className="arrow">→</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
