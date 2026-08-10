"use client";

import React, { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

type StudentData = {
  connectionId: string;
  joinedAt: string;
  id: string;
  fullName: string;
  email: string;
  progressVisible: boolean;
};

type Props = {
  students: StudentData[];
};

export default function TeachersClient({ students }: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredStudents = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ paddingBottom: "60px" }}>
      <AppHeader
        title="Кабинет преподавателя"
        subtitle="Управление учениками и прогрессом"
        nav={[
          { kind: "link", href: "/portal", label: "🏠 Главный портал", className: "btn ghost" },
          { kind: "logout", label: "🚪 Выйти", className: "btn secondary" },
        ]}
      />

      <div className="container" style={{ maxWidth: "1100px" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
          
          {/* ЛЕВАЯ КОЛОНКА: СПИСОК УЧЕНИКОВ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="card" style={{ padding: "24px", borderRadius: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "var(--project-text, #1e293b)" }}>
                  Мои ученики ({students.length})
                </h2>
              </div>
              
              <input
                type="text"
                className="input"
                placeholder="Поиск по имени или email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ marginBottom: "20px", width: "100%" }}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredStudents.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px", color: "#64748b", fontWeight: 600, background: "#f8fafc", borderRadius: "16px", border: "1px dashed #cbd5e1" }}>
                    Ученики не найдены
                  </div>
                ) : (
                  filteredStudents.map((s) => (
                    <div
                      key={s.connectionId}
                      style={{
                        padding: "16px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, color: "#1e293b", fontSize: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {s.fullName || "Без имени"}
                        </div>
                        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                          {s.email}
                        </div>
                      </div>

                      {s.progressVisible ? (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => alert(`В будущем здесь будет переход в профиль ученика (Ghost Mode): ${s.id}`)}
                          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          👁 Прогресс
                        </button>
                      ) : (
                        <div
                          style={{
                            background: "#fef2f2",
                            color: "#991b1b",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            border: "1px solid #fecdd3"
                          }}
                        >
                          Скрыто учеником
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА: УМНАЯ ЛЕНТА (События) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="card" style={{ padding: "24px", borderRadius: "24px", height: "100%" }}>
              <h2 style={{ margin: "0 0 8px 0", fontSize: "20px", fontWeight: 900, color: "var(--project-text, #1e293b)" }}>
                Умная лента ⚡️
              </h2>
              <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "24px" }}>
                События и ошибки ваших учеников в реальном времени.
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "300px",
                  background: "#f8fafc",
                  borderRadius: "16px",
                  border: "2px dashed #e2e8f0",
                  color: "#94a3b8",
                  textAlign: "center",
                  padding: "20px"
                }}
              >
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📭</div>
                <div style={{ fontWeight: 800, fontSize: "16px", color: "#475569" }}>
                  Лента пока пуста
                </div>
                <div style={{ fontSize: "13px", marginTop: "8px" }}>
                  Здесь будут появляться уведомления, когда ваши ученики завершают задания или совершают много ошибок.
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}