// components/rewards/ReferralTab.tsx
"use client";

import React, { useState, useEffect } from "react";
import ReferralTrack, { ReferralStats, ReferralMilestone } from "./ReferralTrack";

type ReferralData = {
  referral_link: string;
  stats: ReferralStats;
  track: ReferralMilestone[];
};

export default function ReferralTab() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile/referrals", { cache: "no-store" })
      .then(res => res.json())
      .then(json => {
        if (!json.ok) throw new Error(json.error || "Ошибка загрузки данных");
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center font-bold text-xs sm:text-sm uppercase tracking-wider opacity-60">
        Загрузка программы...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center font-bold text-xs sm:text-sm text-red-500">
        Ошибка: {error}
      </div>
    );
  }

  if (!data || !data.track || data.track.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center opacity-60 p-6 text-center">
        <div className="mb-4 text-slate-400">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.2 0-2.12.8-2.5 1.9"></path>
            <path d="M8.5 7.5A3.5 3.5 0 1 1 12 11a3.5 3.5 0 0 1-3.5-3.5z"></path>
            <path d="M20 8v6"></path>
            <path d="M23 11h-6"></path>
          </svg>
        </div>
        <div className="font-bold text-sm uppercase tracking-wider mb-2">
          Программа недоступна
        </div>
        <div className="text-xs font-medium max-w-xs mx-auto">
          Администратор пока не добавил ни одной награды в реферальную дорожку.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-2 sm:py-4">
      <div className="text-center space-y-1.5 mb-6">
        <h3 className="text-base sm:text-lg font-black uppercase tracking-wider" style={{ color: "var(--project-text, #1e293b)" }}>
          Пригласи друга
        </h3>
        <p className="text-xs font-medium opacity-60">
          Делись персональной ссылкой. Когда твои друзья будут покупать материалы, ты будешь получать награды и титулы.
        </p>
      </div>

      <div style={{ marginTop: "24px" }}>
        <ReferralTrack link={data.referral_link} stats={data.stats} track={data.track} />
      </div>
    </div>
  );
}