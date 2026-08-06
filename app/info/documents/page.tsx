import Link from "next/link";
import SmartBackButton from "@/components/SmartBackButton";

type SP = { source?: string; sourceId?: string };

// ⚡ Ссылки на документы (замените на реальные адреса Google Drive)
const DOC_LINKS = {
  offerta: "https://drive.google.com/file/d/ВАШ_ID_ОФЕРТЫ/view",
  terms: "https://drive.google.com/file/d/ВАШ_ID_ПОЛЬЗОВАТЕЛЬСКОГО_СОГЛАШЕНИЯ/view",
  privacy: "https://drive.google.com/file/d/ВАШ_ID_ПОЛИТИКИ_КОНФИДЕНЦИАЛЬНОСТИ/view",
  consent: "https://drive.google.com/file/d/ВАШ_ID_СОГЛАСИЯ_НА_ОБРАБОТКУ_ПД/view",
} as const;

export const metadata = {
  title: "Документы",
  description: "Оферта, пользовательское соглашение, политика конфиденциальности и согласие на обработку персональных данных.",
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
        <div className="info-main-card">
          {/* Верхняя панель */}
          <div className="info-topbar">
            <div className="info-topbar-left">
              <SmartBackButton />
              <div className="info-badge" aria-label="Документы">
                <span className="info-badge-dot" />
                <div className="info-badge-text">
                  <span>Раздел</span>
                  <strong>Документы</strong>
                </div>
              </div>
            </div>
          </div>

          <h1 className="info-title">Документы</h1>
          <p className="info-subtitle">
            Официальные документы и правовая информация. Все файлы открываются в Google Диске.
          </p>

          {/* Сетка с документами */}
          <div className="info-grid docs-grid">
            <a
              href={DOC_LINKS.offerta}
              target="_blank"
              rel="noopener noreferrer"
              className="info-card"
            >
              <h3>Оферта</h3>
              <p>Договор оферты на оказание услуг. Условия приобретения материалов и порядок взаимодействия.</p>
            </a>

            <a
              href={DOC_LINKS.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="info-card"
            >
              <h3>Пользовательское соглашение</h3>
              <p>Правила использования сайта и материалов. Общие положения и ограничения ответственности.</p>
            </a>

            <a
              href={DOC_LINKS.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="info-card"
            >
              <h3>Политика конфиденциальности</h3>
              <p>Как мы собираем, храним и защищаем ваши персональные данные.</p>
            </a>

            <a
              href={DOC_LINKS.consent}
              target="_blank"
              rel="noopener noreferrer"
              className="info-card"
            >
              <h3>Согласие на обработку ПД</h3>
              <p>Форма согласия на обработку персональных данных, необходимая для участия.</p>
            </a>
          </div>

          {/* Кнопка возврата */}
          <div className="info-actions" style={{ marginTop: "36px" }}>
            <Link className="info-action-btn" href={`/info${qs}`}>
              <div className="info-action-content">
                <div className="info-action-title">← Назад к информации</div>
                <div className="info-action-sub">прайс, контакты, документы</div>
              </div>
              <span className="info-action-arrow">→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}