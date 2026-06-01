import Link from "next/link";

type SP = { source?: string; sourceId?: string };

export const metadata = {
  title: "Контакты",
  description: "Контакты поддержки: Telegram, ВКонтакте, почта и официальный Telegram-канал ЦФО.",
};

const SUPPORT_EMAIL = "info.ls.2021@gmail.com";
const OFFICIAL_CHANNEL = "https://t.me/hippo_ga_cfo";
const TG_ADMIN_LINK = "https://t.me/skebobingg";
const VK_ADMIN_LINK = "https://vk.com/bluntokyr";

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
              Если прошли сутки, а доступ не появился — лучше сразу пишите в ВКонтакте или Telegram для максимально быстрого ответа, либо отправьте письмо на почту с номером заявки.
            </div>
          </div>

          <h1 className="info-title">Контакты</h1>
          <p className="info-subtitle">
            Оплата по QR в заявке. Выдача доступа после проверки — обычно до 24 часов. По любым вопросам пишите в личные сообщения администратору или на почту.
          </p>

          <div className="section-card">
            <div className="section-head">
              <h2>Связь</h2>
              <div className="pill">support</div>
            </div>

            <div className="contacts-grid">
              <div className="contact-tile">
                <div className="label">Telegram администратора</div>
                <a 
                  href={TG_ADMIN_LINK} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "8px",
                    marginBottom: "4px",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #24a1de, #208ec4)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: "14px",
                    textDecoration: "none",
                    boxShadow: "0 6px 20px rgba(36, 161, 222, 0.3)",
                    textAlign: "center",
                    transition: "transform 0.1s ease"
                  }}
                >
                  Написать в Telegram
                </a>
                <div className="info-note">Самый быстрый способ решения любых вопросов по материалам и оплате.</div>
              </div>

              <div className="contact-tile">
                <div className="label">ВКонтакте администратора</div>
                <a 
                  href={VK_ADMIN_LINK} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "8px",
                    marginBottom: "4px",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #0077ff, #0066da)",
                    color: "#fff",
                    fontWeight: 900,
                    fontSize: "14px",
                    textDecoration: "none",
                    boxShadow: "0 6px 20px rgba(0, 119, 255, 0.3)",
                    textAlign: "center",
                    transition: "transform 0.1s ease"
                  }}
                >
                  Написать во ВКонтакте
                </a>
                <div className="info-note">Оперативная поддержка пользователей, разбор ошибок и доступов.</div>
              </div>

              <div className="contact-tile">
                <div className="label">Email поддержки</div>
                <a 
                  href={`mailto:${SUPPORT_EMAIL}`}
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "8px",
                    marginBottom: "4px",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    background: "rgba(15, 23, 42, 0.05)",
                    border: "1px solid rgba(15, 23, 42, 0.1)",
                    color: "rgba(15, 23, 42, 0.9)",
                    fontWeight: 900,
                    fontSize: "14px",
                    textDecoration: "none",
                    textAlign: "center"
                  }}
                >
                  {SUPPORT_EMAIL}
                </a>
                <div className="info-note">В письме обязательно укажи: номер заявки, область, ФИО и дату оплаты.</div>
              </div>

              <div className="contact-tile">
                <div className="label">Официальный канал олимпиады в ЦФО</div>
                <a 
                  href={OFFICIAL_CHANNEL} 
                  target="_blank" 
                  rel="noreferrer"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: "8px",
                    marginBottom: "4px",
                    padding: "12px 20px",
                    borderRadius: "14px",
                    background: "rgba(78, 205, 196, 0.12)",
                    border: "1px solid rgba(78, 205, 196, 0.25)",
                    color: "#0f766e",
                    fontWeight: 900,
                    fontSize: "14px",
                    textDecoration: "none",
                    textAlign: "center"
                  }}
                >
                  Открыть Telegram-канал
                </a>
                <div className="info-note">Официальные новости, важные объявления и графики проведения по региону.</div>
              </div>

              <div className="contact-tile">
                <div className="label">Сроки проверки оплаты</div>
                <div style={{ fontWeight: 1000, color: "rgba(15,23,42,0.92)", marginTop: "14px", fontSize: "15px" }}>обычно до 24 часов</div>
                <div className="info-note">Если этот срок прошел, а материалы не открылись — обязательно напишите нам.</div>
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