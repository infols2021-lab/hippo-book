declare module "*.css";

export {};

declare global {
  interface Window {
    payformInit?: (domain: string, params: Record<string, any>) => void;
  }
}
