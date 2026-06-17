"use client";

import BackToSourceButton from "@/components/BackToSourceButton";

type Props = {
  canSwitchMode: boolean;
  onSwitchMode: () => void;
};

export default function AssignmentHeader({ canSwitchMode, onSwitchMode }: Props) {
  return (
    <header className="header">
      <div className="header-buttons">
        <BackToSourceButton className="btn secondary" label="← К материалам" fallbackHref="/materials" />
        <button
          className="mode-switch-btn"
          onClick={onSwitchMode}
          style={{ display: canSwitchMode ? "block" : "none" }}
          type="button"
        >
          ↶ Сменить режим
        </button>
      </div>
      <h1>Задание</h1>
    </header>
  );
}
