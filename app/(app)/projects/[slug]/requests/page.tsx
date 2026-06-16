"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function ProjectRequestsPage() {
  const { slug } = useParams() as { slug: string };
  
  const [projectData, setProjectData] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Форма
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загружаем данные ветки (уровни, табы) и историю заявок юзера
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      // 1. Конфиг проекта (открытое API или API для юзера)
      const resConfig = await fetch(`/api/projects/${slug}/config`); // *Предполагается, что ты сделаешь этот мини-роут, возвращающий levels и tabs, либо загрузишь их через Supabase Client
      
      // Давай в этой реализации сходим за заявками
      const resReqs = await fetch(`/api/projects/${slug}/requests`);
      const reqsData = await resReqs.json();
      if (reqsData.ok) setRequests(reqsData.requests);

      // Временный мок данных для селектов, пока не подтянешь из API
      // В идеале: const config = await resConfig.json(); setProjectData(config);
      setProjectData({
        levels: [{ id: "1", level_code: "hippo-1", name: "Hippo 1" }, { id: "2", level_code: "hippo-2", name: "Hippo 2" }],
        tabs: [{ id: "t1", name: "Учебники" }, { id: "t2", name: "Пробные тесты" }]
      });

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (slug) fetchAllData();
  }, [slug]);

  const toggleTab = (tabId: string) => {
    setSelectedTabs(prev => 
      prev.includes(tabId) ? prev.filter(t => t !== tabId) : [...prev, tabId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel) return setError("Пожалуйста, выберите уровень.");
    if (selectedTabs.length === 0) return setError("Выберите хотя бы один раздел материалов.");

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${slug}/requests`, {
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
      fetchAllData(); // Обновляем список
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* ЛЕВАЯ КОЛОНКА: ФОРМА ПОДАЧИ */}
      <div className="lg:col-span-5 space-y-6">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Получить доступ</h2>
          <p className="text-gray-500">Подайте заявку на открытие материалов для вашего уровня.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 border shadow-sm space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: "var(--project-primary)" }} />

          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium">{error}</div>}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Выберите ваш уровень (Класс)</label>
            <select
              required
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full border-2 rounded-xl px-4 py-3 bg-gray-50 outline-none transition-colors"
              style={{ borderBottomColor: selectedLevel ? "var(--project-primary)" : "" }}
            >
              <option value="" disabled>-- Выберите уровень --</option>
              {projectData?.levels.map((l: any) => (
                <option key={l.id} value={l.level_code}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Какие материалы вам нужны?</label>
            <div className="space-y-3">
              {projectData?.tabs.map((t: any) => {
                const isChecked = selectedTabs.includes(t.id);
                return (
                  <label 
                    key={t.id} 
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50'
                    }`}
                    style={isChecked ? { borderColor: "var(--project-primary)" } : {}}
                  >
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300"
                      checked={isChecked}
                      onChange={() => toggleTab(t.id)}
                    />
                    <span className={`font-bold ${isChecked ? 'text-gray-900' : 'text-gray-600'}`}>{t.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full py-4 rounded-xl font-bold text-white transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ backgroundColor: "var(--project-primary)" }}
          >
            {isSubmitting ? "Отправка..." : "Отправить заявку"}
          </button>
        </form>
      </div>

      {/* ПРАВАЯ КОЛОНКА: ИСТОРИЯ */}
      <div className="lg:col-span-7 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">История заявок</h2>
          <p className="text-gray-500">Здесь отображается статус ваших доступов в этой ветке.</p>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-3xl p-10 border shadow-sm text-center text-gray-400">
            Загрузка данных...
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 border border-dashed text-center text-gray-500">
            <div className="text-4xl mb-3">📋</div>
            Вы еще не подавали заявок в эту ветку.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    Заявка: {req.request_number || "Б/Н"}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono uppercase">
                      {req.class_level || req.target_levels?.[0]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Создана: {new Date(req.created_at).toLocaleDateString("ru-RU")}
                  </div>
                </div>
                
                <div>
                  {req.is_processed ? (
                    <span className="bg-green-100 text-green-800 font-bold px-4 py-2 rounded-xl text-sm border border-green-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span> Выдано
                    </span>
                  ) : (
                    <span className="bg-yellow-100 text-yellow-800 font-bold px-4 py-2 rounded-xl text-sm border border-yellow-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> В обработке
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}