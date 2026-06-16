// /loader/types.ts

export type ProjectFeatures = {
  streaks: boolean;
  titles: boolean;
  avatars: boolean;
  leaderboard: boolean;
  profileProgress: boolean;
  requestMode: boolean;
};

export type ProjectTheme = {
  tone: string;
  colors: {
    primary: string;
    secondary: string;
    pageBg?: string;
    cardBg?: string;
  };
  rootClassName?: string;
  cssFile?: string;
  fontFamily?: string;
};

// Если нужны типы для БД:
export type ProjectConfig = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  is_active: boolean;
  theme: ProjectTheme;
  features: ProjectFeatures;
};