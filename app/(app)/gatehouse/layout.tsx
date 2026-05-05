import type { ReactNode } from "react";
import "./gatehouse.css";

export default function GatehouseLayout({ children }: { children: ReactNode }) {
  return <div className="gatehouse-root">{children}</div>;
}