"use client";

import { useState } from "react";
import { useProject } from "./ProjectProvider";

export interface RequestFormLevel {
  id: string;
  level_code: string;
  name: string;
}

export interface RequestFormTab {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  price?: number; // цена за раздел (сумма цен материалов в этом табе)
}

interface RequestsFormProps {
  levels: RequestFormLevel[];
  tabs: RequestFormTab[];
  onSuccess?: () => void;
}

export default function RequestsForm({ levels, tabs, onSuccess }: RequestsFormProps) {
  const project = useProject();
  
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTab = (tabId: string) => {
    setSelectedTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  // Вычисляем итоговую сумму
  const totalPrice = selectedTabs.reduce((sum, tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    return sum + (tab?.price || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel) return setError("Пожалуйста, выберите уровень.");
    if (selectedTabs.length === 0) return setError("Выберите хотя бы один раздел материалов.");

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${project.slug}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level_code: selectedLevel,
          requested_tabs: selectedTabs,
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ошибка при отправке");

      alert("Заявка успешно отправлена! Ожидайте выдачи материалов.");
      setSelectedLevel("");
      setSelectedTabs([]);
      
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (levels.length === 0 || tabs.length === 0) {
    return (
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center text-gray-500">
        Для этой ветки еще не настроены уровни или разделы. Подача заявок временно недоступна.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 md:p-8 border shadow-sm space-y-8 relative overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Декоративная полоса цвета ветки */}
      <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: "var(--project-primary)" }} />

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ШАГ 1: ВЫБОР УРОВНЯ */}
      <div>
        <label className="block text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-3">
          1. Выберите ваш уровень
        </label>
        <select
          required
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="w-full border-2 border-gray-200 focus:border-transparent rounded-xl px-4 py-3.5 bg-gray-50 outline-none transition-all font-medium text-gray-700"
          style={selectedLevel ? { boxShadow: "0 0 0 2px var(--project-primary)" } : {}}
        >
          <option value="" disabled>-- Нажмите, чтобы выбрать класс или сложность --</option>
          {levels.map(l => (
            <option key={l.id} value={l.level_code}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* ШАГ 2: ВЫБОР ТАБОВ С ОТОБРАЖЕНИЕМ ЦЕН */}
      <div>
        <label className="block text-sm font-extrabold text-gray-800 uppercase tracking-wide mb-3">
          2. Какие материалы открыть?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tabs.map(t => {
            const isChecked = selectedTabs.includes(t.id);
            const price = t.price ?? 0;
            const priceDisplay = price > 0 ? `${price} ₽` : "бесплатно";

            return (
              <label 
                key={t.id} 
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                  isChecked ? 'bg-blue-50/30' : 'hover:bg-gray-50 border-gray-100'
                }`}
                style={isChecked ? { borderColor: "var(--project-primary)" } : {}}
              >
                <div 
                  className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${isChecked ? 'border-transparent' : 'border-gray-300'}`}
                  style={isChecked ? { backgroundColor: "var(--project-primary)" } : {}}
                >
                  {isChecked && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                </div>
                <div className="flex-1">
                  <div className={`font-bold ${isChecked ? 'text-gray-900' : 'text-gray-600'}`}>
                    {t.icon} {t.name}
                  </div>
                  {price > 0 && (
                    <div className="text-xs text-gray-500 font-medium mt-0.5">
                      {priceDisplay}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ИТОГОВАЯ СУММА */}
      {totalPrice > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex justify-between items-center">
          <span className="font-bold text-gray-700">Итого к оплате:</span>
          <span className="text-xl font-extrabold text-gray-900">{totalPrice} ₽</span>
        </div>
      )}

      {/* КНОПКА ОТПРАВКИ */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-4 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 text-lg"
        style={{ backgroundColor: "var(--project-primary)" }}
      >
        {isSubmitting ? "Отправка заявки..." : "Отправить заявку на доступ"}
      </button>
    </form>
  );
}