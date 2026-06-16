"use client";

import Link from "next/link";
import PortalCard from "@/components/portal/PortalCard";
import LogoutButton from "@/components/LogoutButton";

// Тип проекта, который прилетит с сервера (из page.tsx)
export type ProjectConfig = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
  };
};

type PortalClientProps = {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  projects: ProjectConfig[]; // НОВЫЙ ПРОП: массив динамических проектов из БД
};

function getDisplayName(userName: string, userEmail: string): string {
  const name = userName.trim();
  if (name) return name;

  const email = userEmail.trim();
  if (email) return email;

  return "ученик";
}

export default function PortalClient({ userName, userEmail, isAdmin, projects }: PortalClientProps) {
  const displayName = getDisplayName(userName, userEmail);

  return (
    <main className="min-h-screen bg-gray-900 text-white relative overflow-hidden font-sans">
      
      {/* ДИНАМИЧЕСКИЙ ФОН: Рисует светящиеся сферы (Orbs) на основе цветов твоих проектов */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {projects.map((p, i) => (
          <div
            key={p.id}
            className="absolute rounded-full blur-[100px] opacity-20 mix-blend-screen animate-in fade-in duration-1000"
            style={{
              backgroundColor: p.theme?.primaryColor || '#3b82f6',
              width: '45vw',
              height: '45vw',
              // Раскидываем сферы по разным углам в зависимости от индекса
              top: i % 2 === 0 ? '-10%' : 'auto',
              bottom: i % 2 !== 0 ? '-10%' : 'auto',
              left: i % 3 === 0 ? '-10%' : 'auto',
              right: i % 3 !== 0 ? '-10%' : 'auto',
            }}
          />
        ))}
        {/* Паттерн-сетка поверх фона */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} 
        />
      </div>

      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12 lg:py-20 flex flex-col min-h-screen">
        
        {/* ШАПКА ПОРТАЛА */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 animate-in slide-in-from-top-6 duration-700">
          <div>
            <p className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-3">
              Выберите направление
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              Добро пожаловать, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{displayName}</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl">
              Ваш единый аккаунт для всех образовательных программ. Выберите ветку для продолжения работы.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl font-bold transition-all backdrop-blur-md shadow-lg"
              >
                ⚙️ Панель управления
              </Link>
            )}
            <div className="bg-white/10 border border-white/10 rounded-xl backdrop-blur-md overflow-hidden transition-all hover:bg-white/20 shadow-lg">
              <LogoutButton className="px-5 py-2.5 font-bold w-full h-full block" />
            </div>
          </div>
        </header>

        {/* СЕТКА ПРОЕКТОВ (ВЕТОК) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-grow items-stretch relative z-20">
          {projects.length > 0 ? (
            projects.map((project, index) => (
              <PortalCard 
                key={project.id} 
                project={project} 
                index={index} 
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-16 border-2 border-dashed border-gray-700 rounded-3xl bg-gray-800/40 backdrop-blur-md animate-in zoom-in-95">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-2xl font-bold mb-2">Платформа настраивается</h3>
              <p className="text-gray-400 text-center">Администратор пока не добавил активные ветки обучения.</p>
            </div>
          )}
        </div>

        {/* ФУТЕР */}
        <footer className="mt-16 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-center items-center gap-3 text-sm text-gray-500 font-medium animate-in fade-in duration-1000">
          <span>Профильные данные общие для всех разделов</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-gray-700" />
          <span>Прогресс и материалы разделяются отдельно</span>
        </footer>

      </section>
    </main>
  );
}