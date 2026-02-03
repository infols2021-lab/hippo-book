import Link from "next/link";

type SP = { source?: string; sourceId?: string };

export const metadata = {
  title: "Контакты",
  description: "Контакты поддержки: почта и официальный Telegram-канал ЦФО.",
};

const SUPPORT_EMAIL = "info.ls.2021@gmail.com";
const OFFICIAL_CHANNEL = "https://t.me/hippo_ga_cfo";
const TG_ADMIN = ""; // по твоей просьбе: пока пусто

function buildQs(sp: SP) {
  const q = new URLSearchParams();
  if (sp.source) q.set("source", sp.source);
  if (sp.sourceId) q.set("sourceId", sp.sourceId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const qs = buildQs(sp);

  return (
    <div className="info-wrap">
      <div className="info-shell">
        <section className="info-hero">
          <div className="info-topbar">
            <div className="info-badge" aria-label="Контакты">
              <span className="info-badge-dot" />
              <div className="info-badge-text">
                <strong>Поддержка</strong>
                <span>как связаться</span>
              </div>
            </div>

            <div className="info-note">
              Если прошли сутки, а доступа нет — напишите на почту и укажите номер заявки + почту, на которую оформляли заявку.
            </div>
          </div>

          <h1 className="info-title">Контакты</h1>
          <p className="info-subtitle">
            Оплата по QR в заявке. Выдача доступа после проверки — обычно до 24 часов. По вопросам пишите ниже.
          </p>

          <div className="section-card">
            <div className="section-head">
              <h2>📮 Связь</h2>
              <div className="pill">support</div>
            </div>

            <div className="contacts-grid">
              <div className="contact-tile">
                <div className="label">Email поддержки</div>
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
                <div className="info-note">В письме укажи: номер заявки, область, ФИО и дату оплаты.</div>
              </div>

              <div className="contact-tile">
                <div className="label">TG администратора</div>
                {TG_ADMIN ? (
                  <a href={TG_ADMIN} target="_blank" rel="noreferrer">
                    {TG_ADMIN}
                  </a>
                ) : (
                  <div style={{ fontWeight: 1000, color: "rgba(15,23,42,0.82)" }}>пока не указан</div>
                )}
                <div className="info-note">Позже можно добавить ссылку на администратора.</div>
              </div>

              <div className="contact-tile">
                <div className="label">Официальный канал олимпиады в ЦФО</div>
                <a href={OFFICIAL_CHANNEL} target="_blank" rel="noreferrer">
                  t.me/hippo_ga_cfo
                </a>
                <div className="info-note">Новости и объявления по региону.</div>
              </div>

              <div className="contact-tile">
                <div className="label">Сроки проверки оплаты</div>
                <div style={{ fontWeight: 1000, color: "rgba(15,23,42,0.92)" }}>обычно до 24 часов</div>
                <div className="info-note">Если прошло больше — пишите в поддержку.</div>
              </div>
            </div>

            {/* ✅ Возврат в /info с теми же query */}
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
