// components/profile/StreakLeaderboardModal.tsx
"use client";

import React, { useMemo } from "react";
import Modal from "@/components/Modal";

export type StreakLeaderboardRow = {
  place: number;
  current: number;
  longest: number;
  isMe?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;

  loading?: boolean;
  error?: string | null;

  top?: StreakLeaderboardRow[] | null;
  around?: StreakLeaderboardRow[] | null;

  myPlace?: number | null;
  myCurrent?: number | null;
  myLongest?: number | null;

  onRetry?: () => void;
};

function dedupeByPlace(rows: StreakLeaderboardRow[]) {
  const map = new Map<number, StreakLeaderboardRow>();
  for (const r of rows) {
    if (!r || typeof r.place !== "number") continue;
    map.set(r.place, r);
  }
  return Array.from(map.values()).sort((a, b) => a.place - b.place);
}

function RowView({ row }: { row: StreakLeaderboardRow }) {
  const isMe = Boolean(row.isMe);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "84px 1fr 1fr",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(25,145,255,0.18)",
        background: isMe ? "rgba(0,235,200,0.14)" : "rgba(255,255,255,0.72)",
        boxShadow: isMe ? "0 10px 22px rgba(0,235,200,0.10)" : "0 10px 22px rgba(6,30,58,0.05)",
        alignItems: "center",
        fontWeight: 900,
      }}
    >
      <div style={{ color: "rgba(7,23,46,0.95)" }}>
        {isMe ? "Вы" : `#${row.place}`}
        {isMe ? <span style={{ marginLeft: 8, opacity: 0.75 }}>#{row.place}</span> : null}
      </div>

      <div style={{ color: "rgba(7,23,46,0.88)" }}>
        Текущая: <span style={{ color: "rgba(0,138,122,1)" }}>{row.current}</span>
      </div>

      <div style={{ color: "rgba(7,23,46,0.88)" }}>
        Максимум: <span style={{ color: "rgba(13,99,255,1)" }}>{row.longest}</span>
      </div>
    </div>
  );
}

export default function StreakLeaderboardModal({
  open,
  onClose,
  loading = false,
  error = null,
  top = null,
  around = null,
  myPlace = null,
  myCurrent = null,
  myLongest = null,
  onRetry,
}: Props) {
  const topRows = useMemo(() => dedupeByPlace(Array.isArray(top) ? top : []), [top]);
  const aroundRows = useMemo(() => dedupeByPlace(Array.isArray(around) ? around : []), [around]);

  const showAround = typeof myPlace === "number" && myPlace > 20;

  const myLine = useMemo(() => {
    if (typeof myPlace !== "number") return null;
    return {
      place: myPlace,
      current: typeof myCurrent === "number" ? myCurrent : 0,
      longest: typeof myLongest === "number" ? myLongest : 0,
      isMe: true,
    } satisfies StreakLeaderboardRow;
  }, [myPlace, myCurrent, myLongest]);

  return (
    <Modal open={open} onClose={onClose} title="🏅 Топ по сериям" maxWidth={720}>
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            borderRadius: 14,
            background: "rgba(25,145,255,0.08)",
            border: "1px solid rgba(25,145,255,0.18)",
            padding: "10px 12px",
            color: "rgba(7,23,46,0.86)",
            fontWeight: 800,
            lineHeight: 1.35,
          }}
        >
          Здесь нет имён - только место в рейтинге, текущая серия и максимальная серия.
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, color: "rgba(7,23,46,0.75)" }}>
            <span className="spinner" />
            Загружаем рейтинг...
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: 14,
              background: "rgba(244,67,54,0.08)",
              border: "1px solid rgba(244,67,54,0.18)",
              padding: "10px 12px",
              color: "#7f1d1d",
              fontWeight: 900,
              lineHeight: 1.35,
            }}
          >
            ❌ Не удалось загрузить рейтинг: {error}
            {onRetry ? (
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={onRetry}>
                  🔄 Повторить
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* TOP 20 */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000, color: "rgba(7,23,46,0.92)" }}>Топ 20 по максимальной серии</div>
          {topRows.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {topRows.map((r) => (
                <RowView key={r.place} row={r} />
              ))}
            </div>
          ) : !loading && !error ? (
            <div style={{ fontWeight: 800, color: "rgba(7,23,46,0.65)" }}>Пока пусто.</div>
          ) : null}
        </div>

        {/* AROUND ME */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000, color: "rgba(7,23,46,0.92)" }}>
            {showAround ? `Ваше место: #${myPlace}` : "Ваши показатели"}
          </div>

          {showAround ? (
            <div style={{ display: "grid", gap: 8 }}>
              {aroundRows.map((r) => (
                <RowView key={r.place} row={r} />
              ))}
              {/* на всякий случай, если around пришёл без "вы" */}
              {myLine && !aroundRows.some((r) => r.isMe) ? <RowView row={myLine} /> : null}
            </div>
          ) : myLine ? (
            <RowView row={myLine} />
          ) : (
            <div style={{ fontWeight: 800, color: "rgba(7,23,46,0.65)" }}>Нет данных по вашему месту.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}