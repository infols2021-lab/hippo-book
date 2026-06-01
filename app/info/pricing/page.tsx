/* app/info/pricing/page.tsx */
import Link from "next/link";

type SP = { source?: string; sourceId?: string; tab?: string };

function lastDayOfCurrentMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 12, 0, 0));
}
function formatRuDate(d: Date) {
  return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "long", day: "2-digit" }).format(d);
}

export const metadata = {
  title: "Прайс",
  description: "Цены на учебники и кроссворды, правила покупки, выдача после проверки оплаты.",
};

const BOOKS = ["Baby Hippo", "Little Hippo", "Hippo 1", "Hippo 2", "Hippo 3", "Hippo 4"] as const;
const CROSSWORDS = ["Below Scale", "CEFR A1", "CEFR A2", "CEFR B1", "CEFR B2", "CEFR C1"] as const;

function buildQs(sp: SP) {
  const q = new URLSearchParams();
  if (sp.source) q.set("source", sp.source);
  if (sp.sourceId) q.set("sourceId", sp.sourceId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

function buildTabLink(sp: SP, tabName: string) {
  const q = new URLSearchParams();
  if (sp.source) q.set("source", sp.source);
  if (sp.sourceId) q.set("sourceId", sp.sourceId);
  q.set("tab", tabName);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const qs = buildQs(sp);
  const currentTab = sp.tab === "exams" ? "exams" : "olympiad";

  const stamp = lastDayOfCurrentMonthUTC();

  return (
    <div className="info-wrap">
      <div className="info-shell">
        <section className="info-hero">
          <div className="info-topbar">
            <div className="info-badge" aria-label="Дата обновления прайса">
              <span className="info-badge-dot" />
              <div className="info-badge-text">
                <strong>Прайс актуален на</strong>
                <span>{formatRuDate(stamp)}</span>
              </div>
            </div>

            <div className="info-note">
              Оплата по QR в заявке. Проверяем вручную и выдаём доступ обычно в течение 24 часов.
            </div>
          </div>

          <h1 className="info-title">Прайс</h1>
          <p className="info-subtitle">
            Выберите интересующий вас раздел ниже, чтобы ознакомиться со стоимостью учебных материалов и проверочных тестов.
          </p>

          {/* Вкладки переключения категорий материалов */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", marginBottom: "6px" }}>
            <Link 
              href={buildTabLink(sp, "olympiad")}
              style={{
                padding: "11px 18px",
                borderRadius: "14px",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: "14px",
                transition: "all 0.12s ease",
                background: currentTab === "olympiad" ? "linear-gradient(135deg, var(--accent2), #6dd3c0)" : "rgba(255, 255, 255, 0.82)",
                color: currentTab === "olympiad" ? "#fff" : "rgba(15, 23, 42, 0.8)",
                boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
                border: "1px solid rgba(15, 23, 42, 0.08)"
              }}
            >
              Олимпиада
            </Link>
            <Link 
              href={buildTabLink(sp, "exams")}
              style={{
                padding: "11px 18px",
                borderRadius: "14px",
                textDecoration: "none",
                fontWeight: 900,
                fontSize: "14px",
                transition: "all 0.12s ease",
                background: currentTab === "exams" ? "linear-gradient(135deg, var(--accent2), #6dd3c0)" : "rgba(255, 255, 255, 0.82)",
                color: currentTab === "exams" ? "#fff" : "rgba(15, 23, 42, 0.8)",
                boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
                border: "1px solid rgba(15, 23, 42, 0.08)"
              }}
            >
              Экзамены
            </Link>
          </div>

          <div className="pricing-wrap">
            {currentTab === "olympiad" ? (
              <>
                <div className="section-card">
                  <div className="section-head">
                    <h2>Учебники</h2>
                    <div className="pill">1000 ₽ / учебник</div>
                  </div>

                  <div className="price-grid">
                    {BOOKS.map((name) => (
                      <div className="price-item" key={name}>
                        <div className="name">{name}</div>
                        <div className="meta">Доступ выдаём после проверки оплаты</div>
                        <div className="price">1000 ₽</div>
                      </div>
                    ))}
                  </div>

                  <ul className="rules-list">
                    <li>
                      В одной заявке можно купить только <strong>один</strong> учебник.
                    </li>
                    <li>Учебник подбирается автоматически под выбранный класс (см. соответствие ниже).</li>
                  </ul>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <h2>Кроссворды</h2>
                    <div className="pill">1000 ₽ / кроссворд</div>
                  </div>

                  <div className="price-grid">
                    {CROSSWORDS.map((name) => (
                      <div className="price-item" key={name}>
                        <div className="name">{name}</div>
                        <div className="meta">Доступ выдаём после проверки оплаты</div>
                        <div className="price">1000 ₽</div>
                      </div>
                    ))}
                  </div>

                  <ul className="rules-list">
                    <li>
                      В одной заявке можно купить только <strong>один</strong> кроссворд.
                    </li>
                    <li>Кроссворд подбирается автоматически под выбранный класс (см. соответствие ниже).</li>
                  </ul>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <h2>Как это работает</h2>
                    <div className="pill">важно</div>
                  </div>

                  <ul className="rules-list">
                    <li>Вы создаёте заявку и получаете QR-код для оплаты.</li>
                    <li>Оплачиваете по QR-коду (как обычный перевод).</li>
                    <li>
                      Мы вручную проверяем оплату и выдаём доступ обычно в течение <strong>24 часов</strong>.
                    </li>
                    <li>Если прошло больше 24 часов — напишите в поддержку (почта + номер заявки).</li>
                  </ul>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <h2>Соответствие по классам</h2>
                    <div className="pill">автовыдача после проверки</div>
                  </div>

                  <div className="mapping-grid">
                    <div className="map-row">
                      <strong>1–2 класс</strong>
                      <div>
                        Учебник: <strong>Baby Hippo</strong>
                        <br />
                        Кроссворд: <strong>Below Scale</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>3–4 класс</strong>
                      <div>
                        Учебник: <strong>Little Hippo</strong>
                        <br />
                        Кроссворд: <strong>CEFR A1</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>5–6 класс</strong>
                      <div>
                        Учебник: <strong>Hippo 1</strong>
                        <br />
                        Кроссворд: <strong>CEFR A2</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>7 класс</strong>
                      <div>
                        Учебник: <strong>Hippo 2</strong>
                        <br />
                        Кроссворд: <strong>CEFR B1</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>8–9 класс</strong>
                      <div>
                        Учебник: <strong>Hippo 3</strong>
                        <br />
                        Кроссворд: <strong>CEFR B2</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>10–11 класс (колледж/1 курс)</strong>
                      <div>
                        Учебник: <strong>Hippo 4</strong>
                        <br />
                        Кроссворд: <strong>CEFR C1</strong>
                      </div>
                    </div>

                    <div className="map-row">
                      <strong>12 (колледж)</strong>
                      <div>
                        Материалы подбираются по внутренним настройкам заявки.
                        <br />
                        Если сомневаетесь — напишите в поддержку перед оплатой.
                      </div>
                    </div>
                  </div>

                  <p className="info-subtitle" style={{ marginTop: 12 }}>
                    Мы выдаём материалы под выбранный класс/уровень после подтверждения оплаты. Если в заявке указан неверный класс —
                    лучше исправить до оплаты.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="section-card">
                  <div className="section-head">
                    <h2>Пробные тестирования</h2>
                    <div className="pill">199 ₽ / тест</div>
                  </div>

                  <div className="price-grid">
                    {["Cadets Stage 1", "Cadets Stage 2", "Cadets Stage 3"].map((name) => (
                      <div className="price-item" key={name}>
                        <div className="name">{name}</div>
                        <div className="meta">Доступ выдаём после проверки оплаты</div>
                        <div className="price">199 ₽</div>
                      </div>
                    ))}
                  </div>

                  <ul className="rules-list">
                    <li>Официальные сертифицированные тесты для проверки реального уровня подготовки.</li>
                    <li>Доступ ко всем заданиям выбранного уровня предоставляется без ограничений.</li>
                  </ul>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <h2>Подготовительные пособия</h2>
                    <div className="pill" style={{ background: "rgba(245, 158, 11, 0.14)", color: "#b45309", border: "1px solid rgba(245, 158, 11, 0.26)" }}>в разработке</div>
                  </div>

                  <div 
                    style={{ 
                      padding: "16px", 
                      background: "rgba(245, 158, 11, 0.06)", 
                      borderRadius: "14px", 
                      border: "1px dashed rgba(245, 158, 11, 0.25)", 
                      marginTop: "12px",
                      color: "#b45309",
                      fontWeight: 800,
                      fontSize: "14px"
                    }}
                  >
                    Данный блок находится в разработке, но совсем скоро будет доступен для всех уровней.
                  </div>
                </div>

                <div className="section-card">
                  <div className="section-head">
                    <h2>Как это работает</h2>
                    <div className="pill">важно</div>
                  </div>

                  <ul className="rules-list">
                    <li>Вы создаёте заявку в личном кабинете экзаменов и получаете QR-код.</li>
                    <li>Производите оплату по QR-коду через мобильное приложение любого банка.</li>
                    <li>
                      Мы вручную проверяем поступление средств и открываем доступ в течение <strong>24 часов</strong>.
                    </li>
                    <li>Для ускорения проверки вы всегда можете написать администратору в Telegram или ВК.</li>
                  </ul>
                </div>
              </>
            )}

            {/* ✅ Возврат в /info с теми же query, чтобы кнопка “назад” там работала правильно */}
            <div className="back-row">
              <Link className="back-link" href={`/info${qs}`}>
                ← Назад к информации
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}