"use client";

import { useState } from "react";
import TextbooksTab from "../textbooks/TextbooksTab";
import CrosswordsTab from "../crosswords/CrosswordsTab";
import GatehouseMockTestsTab from "./GatehouseMockTestsTab";

type Props = {
  onChanged?: () => void | Promise<void>;
};

type BranchTab = "olympiad" | "gatehouse";
type OlympiadTab = "textbooks" | "crosswords";

export default function MaterialsManagementTab({ onChanged }: Props) {
  const [branchTab, setBranchTab] = useState<BranchTab>("olympiad");
  const [olympiadTab, setOlympiadTab] = useState<OlympiadTab>("textbooks");

  return (
    <div>
      <div className="admin-section-head">
        <div>
          <h2>📦 Управление материалами</h2>
          <p>
            Материалы — это контейнеры заданий. В олимпиаде остаются учебники и кроссворды, в
            экзаменах Gatehouse Awards — пробные тесты.
          </p>
        </div>
      </div>

      <div className="admin-tabs" style={{ marginTop: 16, marginBottom: 16 }}>
        <button
          type="button"
          className={branchTab === "olympiad" ? "admin-tab active" : "admin-tab"}
          onClick={() => setBranchTab("olympiad")}
        >
          🏆 Олимпиада
        </button>

        <button
          type="button"
          className={branchTab === "gatehouse" ? "admin-tab active" : "admin-tab"}
          onClick={() => setBranchTab("gatehouse")}
        >
          🎓 Gatehouse Awards
        </button>
      </div>

      {branchTab === "olympiad" ? (
        <div>
          <div className="admin-tabs" style={{ marginBottom: 16 }}>
            <button
              type="button"
              className={olympiadTab === "textbooks" ? "admin-tab active" : "admin-tab"}
              onClick={() => setOlympiadTab("textbooks")}
            >
              📚 Учебники
            </button>

            <button
              type="button"
              className={olympiadTab === "crosswords" ? "admin-tab active" : "admin-tab"}
              onClick={() => setOlympiadTab("crosswords")}
            >
              🧩 Кроссворды
            </button>
          </div>

          {olympiadTab === "textbooks" ? (
            <TextbooksTab onChanged={onChanged} />
          ) : (
            <CrosswordsTab onChanged={onChanged} />
          )}
        </div>
      ) : (
        <GatehouseMockTestsTab onChanged={onChanged} />
      )}
    </div>
  );
}