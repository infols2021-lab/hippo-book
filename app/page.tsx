"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.replace("/login");
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h1>Edu Keys</h1>
        <p>Перенаправляем на вход…</p>
      </div>
    </div>
  );
}
