"use client";

import React, { createContext, useContext } from "react";

// Типизация нашего проекта
export interface ProjectContextType {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  theme: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
  };
  features: {
    hasStreaks?: boolean;
    hasTitles?: boolean;
    hasAvatars?: boolean;
    hasRecommendations?: boolean;
    hasLeaderboard?: boolean;
  };
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export function ProjectProvider({ 
  project, 
  children 
}: { 
  project: ProjectContextType; 
  children: React.ReactNode 
}) {
  return (
    <ProjectContext.Provider value={project}>
      {children}
    </ProjectContext.Provider>
  );
}

// Удобный хук для использования внутри любых компонентов ветки
export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProject должен использоваться внутри <ProjectProvider>");
  }
  return context;
}