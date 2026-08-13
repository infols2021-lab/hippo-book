"use client";

import { formatExamTime } from "@/lib/roadmap/format";

type Props = {
  remainingSec: number;
  totalSec: number;
  urgent?: boolean;
};

export default function ExamTimer({ remainingSec, totalSec, urgent }: Props) {
  const ratio = totalSec > 0 ? remainingSec / totalSec : 0;

  return (
    <div className={`exam-timer ${urgent ? "is-urgent" : ""}`}>
      <div className="exam-timer-label">Экзамен</div>
      <div className="exam-timer-value">{formatExamTime(remainingSec)}</div>
      <div className="exam-timer-bar">
        <div className="exam-timer-bar-fill" style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
      </div>
    </div>
  );
}
