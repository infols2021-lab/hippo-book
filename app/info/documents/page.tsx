import Link from "next/link";

type SP = { source?: string; sourceId?: string };

export const metadata = {
  title: "Документы",
  description: "Раздел документов (временно заглушка).",
};

function buildQs(sp: SP) {
  const q = new URLSearchParams();
  if (sp.source) q.set("source", sp.source);
  if (sp.sourceId) q.set("sourceId", sp.sourceId);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export default async function DocumentsPage({
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
            <div className="info-badge" aria-label="Документы">
              <span className="info-badge-dot" />
              <div className="info-badge-text">
                <strong>Документы</strong>
                <span>в разработке</span>
              </div>
            </div>

            <div className="info-note">
              Этот раздел пока пустой. Мы добавим документы позже.
            </div>
          </div>

          <h1 className="info-title">Документы</h1>
          <p className="info-subtitle">
            Скоро здесь появятся файлы и ссылки (оферта, положения и т.д.).
          </p>

          <div className="section-card">
            <div className="section-head">
              <h2>📄 Скоро будет</h2>
              <div className="pill">placeholder</div>
            </div>

            <ul className="rules-list">
              <li>Оферта / Пользовательское соглашение</li>
              <li>Правила использования материалов</li>
              <li>Реквизиты и контакты</li>
            </ul>

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
