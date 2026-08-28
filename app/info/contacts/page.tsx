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
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f5f8fc",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    }}>
      <div style={{
        maxWidth: "800px",
        margin: "0 auto",
        backgroundColor: "#ffffff",
        borderRadius: "24px",
        padding: "40px",
        boxShadow: "0 10px 40px rgba(0, 118, 255, 0.08)"
      }}>
        
        {/* Шапка */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            backgroundColor: "#e0f2fe",
            padding: "6px 14px",
            borderRadius: "20px",
            marginBottom: "16px"
          }}>
            <span style={{ width: "8px", height: "8px", backgroundColor: "#0284c7", borderRadius: "50%" }}></span>
            <span style={{ color: "#0369a1", fontSize: "13px", fontWeight: 600 }}>Служба поддержки</span>
          </div>
          
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#1d1d1f", margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>
            Контакты
          </h1>
          <p style={{ fontSize: "16px", lineHeight: "1.5", color: "#86868b", margin: 0 }}>
            Выдача доступа после проверки — обычно до 24 часов. Если прошло больше времени, пишите администратору для максимально быстрого решения.
          </p>
        </div>

        {/* Сетка контактов */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginBottom: "36px"
        }}>
          
          {/* Telegram */}
          <div style={{
            backgroundColor: "#fafafa",
            borderRadius: "20px",
            padding: "24px",
            border: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: 700, color: "#1d1d1f", marginBottom: "8px", fontSize: "17px" }}>Telegram</div>
            <div style={{ fontSize: "14px", color: "#86868b", marginBottom: "20px", flexGrow: 1, lineHeight: "1.4" }}>
              Самый быстрый способ решения любых вопросов по материалам и оплате.
            </div>
            <a href={TG_ADMIN_LINK} target="_blank" rel="noreferrer" style={{
              display: "block", width: "100%", boxSizing: "border-box", padding: "14px 20px", borderRadius: "14px",
              background: "linear-gradient(135deg, #24a1de, #208ec4)", color: "#fff", fontWeight: 600, fontSize: "15px",
              textDecoration: "none", textAlign: "center", boxShadow: "0 6px 16px rgba(36, 161, 222, 0.25)"
            }}>
              Написать в Telegram
            </a>
          </div>

          {/* ВКонтакте */}
          <div style={{
            backgroundColor: "#fafafa",
            borderRadius: "20px",
            padding: "24px",
            border: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: 700, color: "#1d1d1f", marginBottom: "8px", fontSize: "17px" }}>ВКонтакте</div>
            <div style={{ fontSize: "14px", color: "#86868b", marginBottom: "20px", flexGrow: 1, lineHeight: "1.4" }}>
              Оперативная поддержка пользователей, разбор ошибок и доступов.
            </div>
            <a href={VK_ADMIN_LINK} target="_blank" rel="noreferrer" style={{
              display: "block", width: "100%", boxSizing: "border-box", padding: "14px 20px", borderRadius: "14px",
              background: "linear-gradient(135deg, #0077ff, #0066da)", color: "#fff", fontWeight: 600, fontSize: "15px",
              textDecoration: "none", textAlign: "center", boxShadow: "0 6px 16px rgba(0, 119, 255, 0.25)"
            }}>
              Написать во ВКонтакте
            </a>
          </div>

          {/* Email */}
          <div style={{
            backgroundColor: "#fafafa",
            borderRadius: "20px",
            padding: "24px",
            border: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: 700, color: "#1d1d1f", marginBottom: "8px", fontSize: "17px" }}>Email поддержки</div>
            <div style={{ fontSize: "14px", color: "#86868b", marginBottom: "20px", flexGrow: 1, lineHeight: "1.4" }}>
              В письме укажи: номер заявки, область, ФИО и дату оплаты.
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{
              display: "block", width: "100%", boxSizing: "border-box", padding: "14px 20px", borderRadius: "14px",
              background: "#f0f0f5", color: "#1d1d1f", fontWeight: 600, fontSize: "15px",
              textDecoration: "none", textAlign: "center"
            }}>
              {SUPPORT_EMAIL}
            </a>
          </div>

          {/* Канал */}
          <div style={{
            backgroundColor: "#f0fdfa",
            borderRadius: "20px",
            padding: "24px",
            border: "1px solid #ccfbf1",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{ fontWeight: 700, color: "#0f766e", marginBottom: "8px", fontSize: "17px" }}>Канал ЦФО</div>
            <div style={{ fontSize: "14px", color: "#115e59", marginBottom: "20px", flexGrow: 1, lineHeight: "1.4" }}>
              Официальные новости, важные объявления и графики проведения.
            </div>
            <a href={OFFICIAL_CHANNEL} target="_blank" rel="noreferrer" style={{
              display: "block", width: "100%", boxSizing: "border-box", padding: "14px 20px", borderRadius: "14px",
              background: "rgba(15, 118, 110, 0.1)", color: "#0f766e", fontWeight: 600, fontSize: "15px",
              textDecoration: "none", textAlign: "center"
            }}>
              Открыть Telegram-канал
            </a>
          </div>
        </div>

        {/* Кнопка назад */}
        <div style={{ paddingTop: "24px", borderTop: "1px solid #f0f0f0" }}>
          <Link href={`/info${qs}`} style={{
            display: "inline-flex",
            alignItems: "center",
            color: "#0284c7",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "15px",
            transition: "opacity 0.2s"
          }}>
            ← Назад к информации
          </Link>
        </div>

      </div>
    </div>
  );
}