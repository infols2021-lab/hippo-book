"use client";

import Link from "next/link";
import PortalCard from "@/components/portal/PortalCard";
import LogoutButton from "@/components/LogoutButton";

export type ProjectConfig = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: {
    primaryColor?: string;
    secondaryColor?: string;
  };
};

type PortalClientProps = {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  projects: ProjectConfig[];
};

export default function PortalClient({ userName, userEmail, isAdmin, projects }: PortalClientProps) {
  const displayName = userName || userEmail || "Ученик";

  return (
    <main className="relative min-h-screen bg-[#0b0f19] text-white overflow-hidden font-sans flex flex-col">
      
      {/* 1. ДИНАМИЧЕСКИЙ ФОН: Делит экран на N равных частей по количеству проектов */}
      <div className="absolute inset-0 z-0 flex">
        {projects.length > 0 ? projects.map((p) => {
          const color = p.theme?.primaryColor || "#3b82f6";
          return (
            <div key={`bg-${p.id}`} className="relative flex-1 h-full border-r border-white/[0.02] last:border-r-0 overflow-hidden">
              {/* Верхний градиент заливки */}
              <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(180deg, ${color}40 0%, transparent 100%)` }} />
              {/* Центральная неоновая сфера для подсветки карточки */}
              <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen opacity-30" style={{ backgroundColor: color }} />
            </div>
          );
        }) : (
          <div className="flex-1 h-full bg-[#0b0f19]" /> // Фоллбэк если нет проектов
        )}
      </div>

      {/* Паттерн-сетка поверх фона */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

      {/* КОНТЕНТ */}
      <section className="relative z-10 w-full max-w-[1400px] mx-auto px-6 py-12 flex flex-col flex-grow">
        
        {/* ШАПКА */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 animate-in slide-in-from-top-8 duration-700">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.2em] text-white/50 uppercase mb-4">Выберите направление</p>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-6 leading-[1.1]">
              Добро пожаловать, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">{displayName}</span>
            </h1>
            <p className="text-lg text-white/60 font-medium">
              Один аккаунт, {projects.length} пространства: выберите нужную ветку для продолжения работы.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/admin" className="px-6 py-2.5 bg-transparent border border-white/20 hover:bg-white/10 text-white rounded-full font-bold transition-all text-sm backdrop-blur-md">
                Админка
              </Link>
            )}
            <LogoutButton className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-bold transition-all text-sm backdrop-blur-md" />
          </div>
        </header>

        {/* УМНАЯ СЕТКА КАРТОЧЕК */}
        <div className={`grid gap-6 flex-grow items-stretch ${
          projects.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 
          projects.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
          'grid-cols-1 md:grid-cols-3'
        }`}>
          {projects.length > 0 ? (
            projects.map((project, index) => (
              <PortalCard 
                key={project.id} 
                project={project} 
                index={index} 
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-16 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 backdrop-blur-md">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-2xl font-bold mb-2">Платформа настраивается</h3>
              <p className="text-white/50">Администратор пока не добавил активные ветки обучения.</p>
            </div>
          )}
        </div>

        {/* ФУТЕР */}
        <footer className="mt-12 flex justify-center items-center py-6 bg-black/20 rounded-full border border-white/5 backdrop-blur-sm mx-auto px-8 w-fit gap-3 text-xs text-white/40 font-medium animate-in fade-in duration-1000">
          <span>Профильные данные общие для всех разделов</span>
          <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
          <span>Прогресс и материалы разделяются отдельно</span>
        </footer>

      </section>
    </main>
  );
}