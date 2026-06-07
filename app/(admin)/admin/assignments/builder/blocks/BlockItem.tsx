"use client";

import React from "react";
import type { 
  InfoBlock, HeroBlock, TextSectionBlock, AlertBlock, 
  VideoBlock, CardsGridBlock, AccordionBlock, DownloadsBlock 
} from "../types";

type Props = {
  block: InfoBlock;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (updated: InfoBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  disabled?: boolean;
};

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФОРМЫ ДЛЯ КАЖДОГО БЛОКА
// ==========================================

function HeroForm({ data, onChange, disabled }: { data: HeroBlock["data"], onChange: (d: HeroBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="small-muted">Бейдж (маленький текст сверху)</label>
        <input className="input" disabled={disabled} value={data.badge || ""} onChange={e => onChange({ ...data, badge: e.target.value })} placeholder="Например: Gatehouse Awards..." />
      </div>
      <div>
        <label className="small-muted">Главный заголовок *</label>
        <input className="input" disabled={disabled} value={data.title} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="Например: Устный экзамен Speaking" />
      </div>
      <div>
        <label className="small-muted">Подзаголовок</label>
        <textarea className="input" disabled={disabled} value={data.subtitle || ""} onChange={e => onChange({ ...data, subtitle: e.target.value })} rows={2} placeholder="Краткое описание гайда..." />
      </div>
      <div>
        <label className="small-muted">Теги/Пиллсы (через запятую)</label>
        <input 
          className="input" 
          disabled={disabled} 
          value={(data.pills || []).join(", ")} 
          onChange={e => onChange({ ...data, pills: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} 
          placeholder="Для ученика, 15 минут, 5 заданий" 
        />
      </div>
    </div>
  );
}

function TextSectionForm({ data, onChange, disabled }: { data: TextSectionBlock["data"], onChange: (d: TextSectionBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Лейбл (надзаголовок)</label>
          <input className="input" disabled={disabled} value={data.label || ""} onChange={e => onChange({ ...data, label: e.target.value })} placeholder="Знакомство" />
        </div>
        <div className="col" style={{ flex: 2 }}>
          <label className="small-muted">Заголовок секции</label>
          <input className="input" disabled={disabled} value={data.title || ""} onChange={e => onChange({ ...data, title: e.target.value })} placeholder="Что такое Speaking?" />
        </div>
      </div>
      <div>
        <label className="small-muted">Текст секции * (поддерживает HTML-теги для выделения)</label>
        <textarea className="input" disabled={disabled} value={data.content} onChange={e => onChange({ ...data, content: e.target.value })} rows={4} placeholder="Speaking — это устная часть..." />
      </div>
    </div>
  );
}

function AlertForm({ data, onChange, disabled }: { data: AlertBlock["data"], onChange: (d: AlertBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Тема</label>
          <select className="input" disabled={disabled} value={data.theme} onChange={e => onChange({ ...data, theme: e.target.value as any })}>
            <option value="info">Синяя (Информация)</option>
            <option value="teacher">Желтая (Для учителя)</option>
            <option value="warning">Красная (Важно)</option>
          </select>
        </div>
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Иконка (Эмодзи)</label>
          <input className="input" disabled={disabled} value={data.icon || ""} onChange={e => onChange({ ...data, icon: e.target.value })} placeholder="🎓" />
        </div>
      </div>
      <div>
        <label className="small-muted">Текст сноски *</label>
        <textarea className="input" disabled={disabled} value={data.content} onChange={e => onChange({ ...data, content: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

function VideoForm({ data, onChange, disabled }: { data: VideoBlock["data"], onChange: (d: VideoBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="small-muted">URL видео (YouTube/Vimeo Embed) *</label>
        <input className="input" disabled={disabled} value={data.url} onChange={e => onChange({ ...data, url: e.target.value })} placeholder="https://www.youtube.com/embed/..." />
      </div>
      <div className="row">
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Подпись на заглушке</label>
          <input className="input" disabled={disabled} value={data.caption || ""} onChange={e => onChange({ ...data, caption: e.target.value })} placeholder="Как играть в Speaking" />
        </div>
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Доп. текст (длительность)</label>
          <input className="input" disabled={disabled} value={data.subCaption || ""} onChange={e => onChange({ ...data, subCaption: e.target.value })} placeholder="~3 минуты" />
        </div>
      </div>
    </div>
  );
}

function CardsGridForm({ data, onChange, disabled }: { data: CardsGridBlock["data"], onChange: (d: CardsGridBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="small-muted">Количество колонок</label>
        <select className="input" disabled={disabled} value={data.columns} onChange={e => onChange({ ...data, columns: Number(e.target.value) })} style={{ width: 120 }}>
          <option value={1}>1 колонка</option>
          <option value={2}>2 колонки</option>
          <option value={3}>3 колонки</option>
          <option value={4}>4 колонки</option>
        </select>
      </div>
      
      {data.items.map((item, i) => (
        <div key={item.id} style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", position: "relative" }}>
          <button 
            type="button" 
            onClick={() => onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) })}
            style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}
          >
            ✖
          </button>
          <div className="row" style={{ marginBottom: 8, paddingRight: 20 }}>
            <div className="col" style={{ width: 60 }}>
              <label className="small-muted">Иконка</label>
              <input className="input" disabled={disabled} value={item.icon || ""} onChange={e => {
                const next = [...data.items]; next[i].icon = e.target.value; onChange({ ...data, items: next });
              }} placeholder="🎲" />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <label className="small-muted">Заголовок карточки *</label>
              <input className="input" disabled={disabled} value={item.title} onChange={e => {
                const next = [...data.items]; next[i].title = e.target.value; onChange({ ...data, items: next });
              }} />
            </div>
            <div className="col" style={{ width: 120 }}>
              <label className="small-muted">Цвет</label>
              <select className="input" disabled={disabled} value={item.theme || "default"} onChange={e => {
                const next = [...data.items]; next[i].theme = e.target.value as any; onChange({ ...data, items: next });
              }}>
                <option value="default">Серый</option>
                <option value="blue">Синий</option>
                <option value="green">Зеленый</option>
                <option value="orange">Оранжевый</option>
                <option value="purple">Пурпурный</option>
              </select>
            </div>
          </div>
          <textarea className="input" rows={2} disabled={disabled} value={item.content} onChange={e => {
            const next = [...data.items]; next[i].content = e.target.value; onChange({ ...data, items: next });
          }} placeholder="Текст карточки..." />
        </div>
      ))}
      <button type="button" className="btn small secondary" disabled={disabled} onClick={() => onChange({
        ...data, items: [...data.items, { id: crypto.randomUUID(), title: "Новая карточка", content: "", theme: "default" }]
      })} style={{ alignSelf: "flex-start" }}>
        ➕ Добавить карточку
      </button>
    </div>
  );
}

function AccordionForm({ data, onChange, disabled }: { data: AccordionBlock["data"], onChange: (d: AccordionBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.items.map((item, i) => (
        <div key={item.id} style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
            <input className="input" style={{ flex: 1 }} disabled={disabled} value={item.title} onChange={e => {
              const next = [...data.items]; next[i].title = e.target.value; onChange({ ...data, items: next });
            }} placeholder="Заголовок/Вопрос *" />
            
            <input className="input" style={{ width: 150 }} disabled={disabled} value={item.tag || ""} onChange={e => {
              const next = [...data.items]; next[i].tag = e.target.value; onChange({ ...data, items: next });
            }} placeholder="Тег (Лексика)" />

            <button type="button" className="btn small" style={{ background: "#ef4444", color: "white" }} disabled={disabled} onClick={() => onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) })}>
              🗑
            </button>
          </div>
          <textarea className="input" rows={3} disabled={disabled} value={item.content} onChange={e => {
            const next = [...data.items]; next[i].content = e.target.value; onChange({ ...data, items: next });
          }} placeholder="Ответ или содержимое..." />
        </div>
      ))}
      <button type="button" className="btn small secondary" disabled={disabled} onClick={() => onChange({
        ...data, items: [...data.items, { id: crypto.randomUUID(), title: "", content: "" }]
      })} style={{ alignSelf: "flex-start" }}>
        ➕ Добавить пункт
      </button>
    </div>
  );
}

function DownloadsForm({ data, onChange, disabled }: { data: DownloadsBlock["data"], onChange: (d: DownloadsBlock["data"]) => void, disabled?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.files.map((file, i) => (
        <div key={file.id} style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col" style={{ width: 60 }}>
              <input className="input" disabled={disabled} value={file.icon || ""} onChange={e => {
                const next = [...data.files]; next[i].icon = e.target.value; onChange({ ...data, files: next });
              }} placeholder="📄" title="Иконка" />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <input className="input" disabled={disabled} value={file.name} onChange={e => {
                const next = [...data.files]; next[i].name = e.target.value; onChange({ ...data, files: next });
              }} placeholder="Название файла *" />
            </div>
            <div className="col" style={{ width: 100 }}>
              <input className="input" disabled={disabled} value={file.fileType} onChange={e => {
                const next = [...data.files]; next[i].fileType = e.target.value; onChange({ ...data, files: next });
              }} placeholder="PDF / DOCX" />
            </div>
            <div className="col" style={{ width: 120 }}>
              <select className="input" disabled={disabled} value={file.theme || "default"} onChange={e => {
                const next = [...data.files]; next[i].theme = e.target.value as any; onChange({ ...data, files: next });
              }}>
                <option value="default">Серый</option>
                <option value="blue">Синий</option>
                <option value="green">Зеленый</option>
                <option value="orange">Оранжевый</option>
                <option value="red">Красный</option>
                <option value="gold">Золотой</option>
              </select>
            </div>
            <button type="button" className="btn small" style={{ background: "#ef4444", color: "white", marginTop: 24 }} disabled={disabled} onClick={() => onChange({ ...data, files: data.files.filter((_, idx) => idx !== i) })}>
              🗑
            </button>
          </div>
          <div className="row">
            <div className="col" style={{ flex: 1 }}>
              <input className="input" disabled={disabled} value={file.url} onChange={e => {
                const next = [...data.files]; next[i].url = e.target.value; onChange({ ...data, files: next });
              }} placeholder="Ссылка на файл (URL) *" />
            </div>
            <div className="col" style={{ flex: 1 }}>
              <input className="input" disabled={disabled} value={file.description || ""} onChange={e => {
                const next = [...data.files]; next[i].description = e.target.value; onChange({ ...data, files: next });
              }} placeholder="Краткое описание (опционально)" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn small secondary" disabled={disabled} onClick={() => onChange({
        ...data, files: [...data.files, { id: crypto.randomUUID(), name: "", url: "", fileType: "PDF" }]
      })} style={{ alignSelf: "flex-start" }}>
        ➕ Добавить файл
      </button>
    </div>
  );
}

// ==========================================
// ГЛАВНЫЙ КОМПОНЕНТ ОБОЛОЧКИ БЛОКА
// ==========================================

export default function BlockItem({ block, index, isFirst, isLast, onChange, onRemove, onMoveUp, onMoveDown, disabled }: Props) {
  
  // Определяем название и иконку блока для хедера
  let title = "Блок";
  let icon = "📦";
  
  switch(block.type) {
    case "hero": title = "Обложка (Hero)"; icon = "🖼"; break;
    case "text_section": title = "Текстовая секция"; icon = "📝"; break;
    case "alert": title = "Предупреждение/Сноска"; icon = "⚠️"; break;
    case "video": title = "Видео"; icon = "🎥"; break;
    case "cards_grid": title = "Сетка карточек"; icon = "🗂"; break;
    case "accordion": title = "Спойлеры (FAQ)"; icon = "🔽"; break;
    case "downloads": title = "Файлы для скачивания"; icon = "⬇️"; break;
  }

  // Главный свитчер форм
  function renderForm() {
    switch(block.type) {
      case "hero": return <HeroForm data={block.data} onChange={d => onChange({ ...block, data: d } as HeroBlock)} disabled={disabled} />;
      case "text_section": return <TextSectionForm data={block.data} onChange={d => onChange({ ...block, data: d } as TextSectionBlock)} disabled={disabled} />;
      case "alert": return <AlertForm data={block.data} onChange={d => onChange({ ...block, data: d } as AlertBlock)} disabled={disabled} />;
      case "video": return <VideoForm data={block.data} onChange={d => onChange({ ...block, data: d } as VideoBlock)} disabled={disabled} />;
      case "cards_grid": return <CardsGridForm data={block.data} onChange={d => onChange({ ...block, data: d } as CardsGridBlock)} disabled={disabled} />;
      case "accordion": return <AccordionForm data={block.data} onChange={d => onChange({ ...block, data: d } as AccordionBlock)} disabled={disabled} />;
      case "downloads": return <DownloadsForm data={block.data} onChange={d => onChange({ ...block, data: d } as DownloadsBlock)} disabled={disabled} />;
      default: return <div style={{ color: "red" }}>Неизвестный тип блока</div>;
    }
  }

  return (
    <div style={{ 
      background: "#fff", 
      border: "1px solid #cbd5e1", 
      borderRadius: 12, 
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      {/* HEADER: Управление блоком */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        background: "#f1f5f9", 
        padding: "10px 16px",
        borderBottom: "1px solid #cbd5e1"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ 
            background: "#fff", width: 28, height: 28, borderRadius: 6, 
            display: "flex", alignItems: "center", justifyContent: "center", 
            fontWeight: 800, fontSize: 13, color: "#64748b", border: "1px solid #cbd5e1" 
          }}>
            {index + 1}
          </div>
          <div style={{ fontWeight: 600, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{icon}</span> {title}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn small ghost" disabled={disabled || isFirst} onClick={onMoveUp} title="Поднять выше">
            ⬆️
          </button>
          <button type="button" className="btn small ghost" disabled={disabled || isLast} onClick={onMoveDown} title="Опустить ниже">
            ⬇️
          </button>
          <div style={{ width: 1, background: "#cbd5e1", margin: "0 4px" }} />
          <button type="button" className="btn small ghost" disabled={disabled} onClick={onRemove} title="Удалить блок" style={{ color: "#ef4444" }}>
            ✖
          </button>
        </div>
      </div>

      {/* BODY: Форма настроек блока */}
      <div style={{ padding: 16 }}>
        {renderForm()}
      </div>
    </div>
  );
}