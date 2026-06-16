// app/(admin)/admin/projects/ProjectsTab.tsx
"use client";

import { useState, useEffect } from "react";
import ProjectEditor from "./ProjectEditor";

export default function ProjectsTab() {
  const [projects, setProjects] = useState<any[]>([]);
  const [editingProject, setEditingProject] = useState<any | "new" | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/projects");
      const data = await res.json();
      setProjects(data.projects || data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  if (editingProject) {
    return (
      <ProjectEditor 
        project={editingProject === "new" ? null : editingProject} 
        onClose={() => setEditingProject(null)} 
        onSaved={() => {
          setEditingProject(null);
          loadProjects();
        }} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold">Проекты (Ветки)</h2>
          <p className="text-sm text-gray-500">Управление глобальными направлениями</p>
        </div>
        <button 
          onClick={() => setEditingProject("new")}
          className="bg-gray-900 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors"
        >
          + Создать ветку
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-10 font-bold">Загрузка проектов...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map(p => (
            <div key={p.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col items-start hover:shadow-md transition-all">
              <h3 className="text-lg font-bold mb-1" style={{ color: p.theme?.colors?.primary || "#111" }}>{p.name}</h3>
              <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded mb-4">/{p.slug}</span>
              
              <div className="mt-auto pt-4 border-t w-full flex justify-between items-center">
                <span className={`text-xs font-bold px-2 py-1 rounded ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.is_active ? "Активен" : "Скрыт"}
                </span>
                <button 
                  onClick={() => setEditingProject(p)}
                  className="text-blue-600 font-bold text-sm hover:underline"
                >
                  Настроить →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}