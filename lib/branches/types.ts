export type BranchType = "olympiad" | "gatehouse";

export type BranchTone = "warm" | "dark-indigo";

export type BranchRouteConfig = {
  portal: string;
  profile: string;
  materials: string;
  requests: string;
  assignment: (id: string) => string;
  material: (id: string) => string;
};

export type BranchThemeConfig = {
  tone: BranchTone;
  rootClassName: string;
  cssFile?: string;
  fontFamily: string;
  colors: {
    pageBg: string;
    cardBg: string;
    cardBgSoft: string;
    primary: string;
    primarySoft: string;
    secondary: string;
    accent: string;
    accentSoft: string;
    text: string;
    muted: string;
    border: string;
    glow: string;
  };
};

export type PortalCardImageConfig = {
  src: string;
  alt: string;
};

export type PortalCardConfig = {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  href: string;
  image: PortalCardImageConfig | null;
  fallbackIcon: string;
};

export type BranchMaterialTabConfig = {
  key: string;
  label: string;
  icon: string;
  materialKind: string | null;
  isPlaceholder?: boolean;
};

export type BranchRequestConfig = {
  targetMode: "class_level" | "target_levels";
  materialKinds: string[];
  defaultMaterialKinds: string[];
};

export type BranchConfig = {
  type: BranchType;
  label: string;
  shortLabel: string;
  adminLabel: string;
  description: string;
  theme: BranchThemeConfig;
  routes: BranchRouteConfig;
  portalCard: PortalCardConfig;
  materialTabs: BranchMaterialTabConfig[];
  requests: BranchRequestConfig;
  hasOlympiadStreaks: boolean;
};