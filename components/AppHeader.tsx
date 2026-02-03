import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

type NavItem =
  | { kind: "link"; href: string; label: string; className?: string }
  | { kind: "logout"; label?: string; className?: string };

type Props = {
  markText?: string; // EK
  title?: string; // Edu Keys
  subtitle?: string; // 🎓 ...
  // элементы в правой части, строго по порядку
  nav?: NavItem[];
};

export default function AppHeader({
  markText = "EK",
  title = "Edu Keys",
  subtitle = "🎓 Образовательная платформа",
  nav = [
    { kind: "link", href: "/materials", label: "📚 Материалы", className: "btn" },
    { kind: "link", href: "/profile", label: "👤 Профиль", className: "btn" },
    { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
  ],
}: Props) {
  return (
    <div className="header">
      <div className="logo">
        <div className="mark">{markText}</div>

        <div>
          <h3
            style={{
              background: "linear-gradient(135deg, var(--accent2), #6dd3c0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              margin: 0,
            }}
          >
            {title}
          </h3>
          <div className="small-muted">{subtitle}</div>
        </div>
      </div>

      <div className="nav">
        {nav.map((item, idx) => {
          if (item.kind === "link") {
            return (
              <Link key={`${item.href}-${idx}`} className={item.className || "btn"} href={item.href}>
                {item.label}
              </Link>
            );
          }

          return (
            <LogoutButton key={`logout-${idx}`} className={item.className || "btn secondary"}>
              {item.label || "🚪 Выйти"}
            </LogoutButton>
          );
        })}
      </div>
    </div>
  );
}
