"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProjectProvider, ProjectContextType } from "./ProjectProvider";

interface ProjectShellProps {
  project: ProjectContextType;
  children: React.ReactNode;
}

export default function ProjectShell({ project, children }: ProjectShellProps) {
  const pathname = usePathname();
  const baseUrl = `/projects/${project.slug}`;

  // Настраиваем цвета с фоллбэками на случай, если админ их не задал
  const primaryColor = project.theme?.primaryColor || "#3b82f6";
  const secondaryColor = project.theme?.secondaryColor || "#1d4ed8";
  const bgColor = project.theme?.backgroundColor || "#f8fafc";

  // Локальная навигация ветки
  const navLinks = [
    { href: baseUrl, label: "Главная" },
    { href: `${baseUrl}/materials`, label: "Материалы" },
    { href: `${baseUrl}/requests`, label: "Мои доступы" },
    { href: `${baseUrl}/profile`, label: "Профиль ветки", isHighlight: true },
  ];

  return (
    <ProjectProvider project={project}>
<div
        style={{
          "--project-primary": primaryColor,
          "--project-secondary": secondaryColor,
          "--project-bg": bgColor,
          backgroundColor: "var(--project-bg)",
        } as React.CSSProperties}
        className="min-h-screen transition-colors duration-500"
      >
        {/* ЛОКАЛЬНАЯ ШАПКА ВЕТКИ */}
        <nav className="bg-white border-b sticky top-0 z-30 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <Link 
                href="/portal" 
                className="text-gray-400 hover:text-gray-800 transition-colors bg-gray-50 hover:bg-gray-200 p-2 rounded-xl"
                title="Вернуться в Портал"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div className="h-6 w-px bg-gray-200 hidden md:block" />
              <Link href={baseUrl}>
                <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--project-primary)" }}>
                  {project.name}
                </h1>
              </Link>
            </div>
            
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
              {navLinks.map((link) => {
                // Точное совпадение для главной, частичное для остальных (чтобы таб светился, если мы внутри материала)
                const isActive = link.href === baseUrl 
                  ? pathname === link.href 
                  : pathname.startsWith(link.href);

                return (
                  <Link 
                    key={link.href}
                    href={link.href} 
                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                      link.isHighlight 
                        ? isActive ? 'text-white shadow-md' : 'text-gray-700 bg-gray-100 hover:bg-gray-200' 
                        : isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                    style={isActive && link.isHighlight ? { backgroundColor: "var(--project-primary)", color: "#fff" } : {}}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* ОСНОВНОЙ КОНТЕНТ */}
        <main className="max-w-7xl mx-auto px-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </main>
      </div>
    </ProjectProvider>
  );
}