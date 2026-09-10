import Link from "next/link";
import "./info.css";

type SP = { source?: string; sourceId?: string };

// Возвращает сегодняшнюю дату по московскому времени (UTC+3), зафиксированную на полдень UTC,
// чтобы при форматировании в любом часовом поясе сервера число оставалось корректным.
function todayMoscowDate(): Date {
  const now = new Date();
  // Получаем московское время в виде строки и парсим обратно в Date
  const msk = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }));
  const y = msk.getFullYear();
  const m = msk.getMonth();
  const d = msk.getDate();
  // Фиксируем 12:00 UTC того же календарного дня – так дата не «уплывёт» при смене таймзоны
  return new Date(Date.UTC(y, m, d, 12, 0, 0));
}

function formatRuDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(d);
}

export const metadata = {
  title: "Информация для участников",
  description:
    "Прайс, контакты и документы. Оплата онлайн, доступ открывается автоматически после подтверждения платежа.",
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

  // Теперь stamp – всегда сегодняшняя дата по Москве
  const stamp = todayMoscowDate();

  return (
    <div className="info-wrap">
      <div className="info-shell">
        <div className="info-main-card">
          {/* Верхняя панель */}
          <div className="info-topbar">
            <div className="info-topbar-left">
              <Link href="/login" className="info-back-btn" aria-label="Назад ко входу">
                ← Назад
              </Link>
              <div className="info-badge" aria-label="Дата обновления">
                <span className="info-badge-dot" />
                <div className="info-badge-text">
                  <span>Обновление страницы:</span>
                  <strong>{formatRuDate(stamp)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Плашка с важным уведомлением */}
          <div className="info-banner">
            <span className="info-banner-icon"></span>
            <div>
              <strong>Важно:</strong> оплата проходит онлайн через СБП или банковскую карту.
              Доступ к материалам предоставляется автоматически сразу после подтверждения оплаты.
            </div>
          </div>

          <h1 className="info-title">Информация для участников</h1>
          <p className="info-subtitle">
            Здесь собраны все ключевые сведения: стоимость материалов, порядок
            оплаты и правила получения доступа.
          </p>

          {/* Карточки с правилами */}
          <div className="info-grid">
            <div className="info-card">
              <div className="info-card-icon"></div>
              <h3>Как проходит оплата</h3>
              <p>
                В заявке вы переходите к оплате в защищённом окне — банковской картой
                или через СБП. Доступ к материалам предоставляется автоматически сразу
                после подтверждения оплаты.
              </p>
            </div>

            <div className="info-card">
              <div className="info-card-icon"></div>
              <h3>Что можно купить</h3>
              <p>
                В одной заявке можно приобрести любые материалы. Отображаются
                материалы того проекта, в котором{" "}
                <strong>вы СЕЙЧАС находитесь</strong> количество материалов в
                одной заявке <strong>НЕОГРАНИЧЕННО</strong>
              </p>
            </div>

            <div className="info-card">
              <div className="info-card-icon"></div>
              <h3>Поддержка</h3>
              <p>
                Если доступ не открылся в течение нескольких минут — напишите в
                поддержку, указав ваш e-mail и номер заявки. Мы поможем оперативно
                разобраться.
              </p>
            </div>
          </div>

          {/* Навигационные кнопки-карточки */}
          <div className="info-actions">
            <Link className="info-action-btn" href={`/info/pricing${qs}`}>
              <div className="info-action-content">
                <div className="info-action-title">Прайс и Каталог</div>
                <div className="info-action-sub">
                  актуальные цены и материалы
                </div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>

            <Link className="info-action-btn" href={`/info/contacts${qs}`}>
              <div className="info-action-content">
                <div className="info-action-title">Контакты</div>
                <div className="info-action-sub">способы связи с нами</div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>

            <Link className="info-action-btn" href={`/info/documents${qs}`}>
              <div className="info-action-content">
                <div className="info-action-title">Документы</div>
                <div className="info-action-sub">официальная информация</div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>

            <Link className="info-action-btn" href="/olympiads/hippo">
              <div className="info-action-content">
                <div className="info-action-title">Олимпиада HIPPO</div>
                <div className="info-action-sub">подготовка к олимпиаде по английскому</div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>

            <Link className="info-action-btn" href="/exams/gatehouse-awards">
              <div className="info-action-content">
                <div className="info-action-title">Gatehouse Awards</div>
                <div className="info-action-sub">подготовка к экзаменам ESOL</div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}