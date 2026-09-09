import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

type SP = { source?: string; sourceId?: string };

export const metadata = {
  title: "Контакты",
  description:
    "Контакты поддержки: Telegram, ВКонтакте, почта и официальный Telegram-канал ЦФО.",
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

// Адаптивная вёрстка: вместо фиксированных px используем clamp()/vw, поэтому
// страница корректно выглядит на экранах от 320px до десктопа — без
// горизонтального скролла и «уехавших» карточек.
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const styles = {
  shell: {
    minHeight: "100vh",
    backgroundColor: "#f5f8fc",
    padding: "clamp(14px, 4vw, 40px) 14px",
    fontFamily: FONT,
    boxSizing: "border-box",
    width: "100%",
    overflowX: "hidden",
  },
  card: {
    maxWidth: "800px",
    margin: "0 auto",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    borderRadius: "clamp(20px, 5vw, 24px)",
    padding: "clamp(18px, 5vw, 40px)",
    boxShadow: "0 10px 40px rgba(0, 118, 255, 0.08)",
  },
  header: { marginBottom: "clamp(20px, 5vw, 36px)" },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "#e0f2fe",
    padding: "6px 14px",
    borderRadius: "20px",
    marginBottom: "14px",
    flexWrap: "wrap",
    boxSizing: "border-box",
  },
  badgeDot: { width: 8, height: 8, backgroundColor: "#0284c7", borderRadius: "50%", flexShrink: 0 },
  badgeText: { color: "#0369a1", fontSize: 13, fontWeight: 600 },
  h1: {
    fontSize: "clamp(24px, 6vw, 32px)",
    fontWeight: 800,
    color: "#1d1d1f",
    margin: "0 0 10px 0",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  lead: {
    fontSize: "clamp(14px, 3.6vw, 16px)",
    lineHeight: 1.55,
    color: "#86868b",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(250px, 100%), 1fr))",
    gap: "14px",
    marginBottom: "32px",
    minWidth: 0,
  },
  backBox: { paddingTop: "clamp(16px, 4vw, 24px)", borderTop: "1px solid #f0f0f0" },
} satisfies Record<string, CSSProperties>;

function ContactCard({
  title,
  desc,
  descColor,
  background,
  border,
  children,
}: {
  title: string;
  desc: string;
  descColor?: string;
  background?: string;
  border?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: background || "#fafafa",
        borderRadius: "clamp(16px, 4vw, 20px)",
        padding: "clamp(16px, 4vw, 24px)",
        border: `1px solid ${border || "#f0f0f0"}`,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div style={{ fontWeight: 700, color: "#1d1d1f", marginBottom: 8, fontSize: "clamp(15px, 4vw, 17px)" }}>
        {title}
      </div>
      <div
        style={{
          fontSize: "clamp(13px, 3.6vw, 14px)",
          color: descColor || "#86868b",
          marginBottom: "16px",
          flexGrow: 1,
          lineHeight: 1.5,
          minWidth: 0,
        }}
      >
        {desc}
      </div>
      {children}
    </div>
  );
}

function Cta({
  href,
  external,
  background,
  color,
  children,
}: {
  href: string;
  external?: boolean;
  background: string;
  color: string;
  children: ReactNode;
}) {
  const extra = external ? { target: "_blank", rel: "noreferrer" } : {};
  return (
    <a
      href={href}
      {...extra}
      style={{
        display: "block",
        width: "100%",
        boxSizing: "border-box",
        padding: "13px 16px",
        borderRadius: "14px",
        background,
        color,
        fontWeight: 600,
        fontSize: "clamp(13px, 3.6vw, 15px)",
        textDecoration: "none",
        textAlign: "center",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        minWidth: 0,
      }}
    >
      {children}
    </a>
  );
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const qs = buildQs(sp);

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        {/* Шапка */}
        <div style={styles.header}>
          <div style={styles.badge}>
            <span style={styles.badgeDot} />
            <span style={styles.badgeText}>Служба поддержки</span>
          </div>

          <h1 style={styles.h1}>Контакты</h1>
          <p style={styles.lead}>
            Выдача доступа после проверки — обычно до 24 часов. Если прошло больше времени,
            пишите администратору для максимально быстрого решения.
          </p>
        </div>

        {/* Сетка контактов */}
        <div style={styles.grid}>
          {/* Telegram */}
          <ContactCard
            title="Telegram"
            desc="Самый быстрый способ решения любых вопросов по материалам и оплате."
          >
            <Cta
              href={TG_ADMIN_LINK}
              external
              background="linear-gradient(135deg, #24a1de, #208ec4)"
              color="#fff"
            >
              Написать в Telegram
            </Cta>
          </ContactCard>

          {/* ВКонтакте */}
          <ContactCard
            title="ВКонтакте"
            desc="Оперативная поддержка пользователей, разбор ошибок и доступов."
          >
            <Cta
              href={VK_ADMIN_LINK}
              external
              background="linear-gradient(135deg, #0077ff, #0066da)"
              color="#fff"
            >
              Написать во ВКонтакте
            </Cta>
          </ContactCard>

          {/* Email */}
          <ContactCard
            title="Email поддержки"
            desc="В письме укажи: номер заявки, область, ФИО и дату оплаты."
          >
            <Cta href={`mailto:${SUPPORT_EMAIL}`} background="#f0f0f5" color="#1d1d1f">
              {SUPPORT_EMAIL}
            </Cta>
          </ContactCard>

          {/* Канал */}
          <ContactCard
            title="Канал ЦФО"
            desc="Официальные новости, важные объявления и графики проведения."
            background="#f0fdfa"
            border="#ccfbf1"
            descColor="#115e59"
          >
            <Cta
              href={OFFICIAL_CHANNEL}
              external
              background="rgba(15, 118, 110, 0.1)"
              color="#0f766e"
            >
              Открыть Telegram-канал
            </Cta>
          </ContactCard>
        </div>

        {/* Кнопка назад */}
        <div style={styles.backBox}>
          <Link
            href={`/info${qs}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              color: "#0284c7",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "clamp(13px, 3.6vw, 15px)",
              transition: "opacity 0.2s",
              padding: "6px 0",
            }}
          >
            ← Назад к информации
          </Link>
        </div>
      </div>
    </div>
  );
}

