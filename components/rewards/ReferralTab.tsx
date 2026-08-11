"use client";

import React, { useState, useEffect } from "react";
import ReferralTimeline, { ReferralStats, ReferralMilestone } from "./ReferralTimeline";
import RewardUnboxModal, { UnboxedRewardItem } from "./RewardUnboxModal";
import MaterialChoiceModal, { MaterialChoiceSuccessResult } from "./MaterialChoiceModal";

type ReferralData = {
  referral_link: string;
  stats: ReferralStats;
  track: ReferralMilestone[];
  inviter?: { id: string; name: string } | null;
  welcome_bonus_available?: boolean;
};

export default function ReferralTab() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [unboxModalOpen, setUnboxModalOpen] = useState(false);
  const [unboxedItems, setUnboxedItems] = useState<UnboxedRewardItem[]>([]);

  const [choiceModalState, setChoiceModalState] = useState<{
    isOpen: boolean;
    milestoneId: string;
    maxPrice: number;
    choiceCount: number;
  }>({ isOpen: false, milestoneId: "", maxPrice: 0, choiceCount: 0 });

  const loadData = () => {
    setLoading(true);
    fetch("/api/profile/referrals", { cache: "no-store" })
      .then(res => res.json())
      .then(json => {
        if (!json.ok) throw new Error(json.error || "Ошибка загрузки данных");
        setData(json);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch("/api/profile/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        setSubmitMessage({ type: "success", text: "Код успешно применен!" });
        setInviteCode("");
        loadData();
      } else {
        setSubmitMessage({ type: "error", text: json.error || "Ошибка привязки кода" });
      }
    } catch (err: any) {
      setSubmitMessage({ type: "error", text: "Сетевая ошибка" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimWelcome = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/referrals/claim-welcome", { method: "POST" });
      const json = await res.json();
      
      if (res.ok && json.ok) {
        if (json.grantedRewards && json.grantedRewards.length > 0) {
          setUnboxedItems(json.grantedRewards);
          setUnboxModalOpen(true);
        }
        loadData();
      } else {
        alert(json.error || "Ошибка получения бонуса");
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimMilestone = async (milestone: ReferralMilestone) => {
    if (milestone.choice_count > 0) {
      setChoiceModalState({
        isOpen: true,
        milestoneId: milestone.id,
        maxPrice: milestone.max_price,
        choiceCount: milestone.choice_count
      });
    } else {
      setSubmitting(true);
      try {
        const res = await fetch("/api/profile/referrals/claim-milestone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ milestoneId: milestone.id, chosenMaterialIds: [] }),
        });
        const json = await res.json();
        
        if (res.ok && json.ok) {
          if (json.grantedRewards && json.grantedRewards.length > 0) {
            setUnboxedItems(json.grantedRewards);
            setUnboxModalOpen(true);
          }
          loadData();
        } else {
          alert(json.error || "Ошибка получения награды");
        }
      } catch (e) {
        alert("Ошибка сети");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleChoiceSuccess = (result: MaterialChoiceSuccessResult) => {
    setChoiceModalState({ ...choiceModalState, isOpen: false });
    if (result.unboxItems && result.unboxItems.length > 0) {
      setUnboxedItems(result.unboxItems);
      setUnboxModalOpen(true);
    }
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-[50vh] items-center justify-center opacity-50">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4"></div>
        <div className="font-bold text-xs uppercase tracking-wider text-slate-600">Загрузка программы...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center font-bold text-sm text-red-500 bg-red-50 p-6 rounded-2xl border border-red-100">
        Ошибка: {error}
      </div>
    );
  }

  if (!data || !data.track || data.track.length === 0) {
    return (
      <div className="flex flex-col h-[60vh] items-center justify-center opacity-60 p-6 text-center">
        <div className="mb-4 text-slate-300">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.2 0-2.12.8-2.5 1.9"></path>
            <path d="M8.5 7.5A3.5 3.5 0 1 1 12 11a3.5 3.5 0 0 1-3.5-3.5z"></path>
            <path d="M20 8v6"></path>
            <path d="M23 11h-6"></path>
          </svg>
        </div>
        <div className="font-black text-base uppercase tracking-wider mb-2 text-slate-700">
          Программа недоступна
        </div>
        <div className="text-sm font-medium max-w-xs mx-auto text-slate-500">
          Администратор пока не добавил ни одной награды в реферальную дорожку.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6">
      
      {/* Блок "Кто вас пригласил" с кнопкой забрать */}
      <div className="mb-10 p-6 sm:p-8 bg-white border border-slate-200 rounded-[28px] shadow-sm">
        <h4 className="font-black text-base uppercase tracking-wider text-slate-800 mb-5 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M16 21v-2a4 4 0 0 0-4-4H5c-1.2 0-2.12.8-2.5 1.9"></path><path d="M8.5 7.5A3.5 3.5 0 1 1 12 11a3.5 3.5 0 0 1-3.5-3.5z"></path></svg>
          Кто вас пригласил?
        </h4>
        
        {data.inviter ? (
          <div className="text-sm font-medium text-slate-600 bg-slate-50 p-5 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              Вас пригласил(а): <span className="font-black text-slate-900 text-base">{data.inviter.name}</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="text-[10px] font-black uppercase tracking-wider px-3 py-1.5 bg-white text-slate-500 rounded-lg border border-slate-200 shrink-0 shadow-sm">
                Привязан
              </div>
              {data.welcome_bonus_available && (
                <button 
                  onClick={handleClaimWelcome} 
                  disabled={submitting}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
                >
                  Забрать бонус
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 font-medium mb-5">
              Если у вас есть код друга или реферальная ссылка, введите ее здесь, чтобы получить приветственный бонус.
            </p>
            <form onSubmit={handleApplyCode} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Вставьте ссылку или код"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="flex-1 px-5 py-3.5 rounded-xl border border-slate-300 font-medium text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting || !inviteCode.trim()}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 shadow-md shadow-blue-500/20 whitespace-nowrap"
              >
                {submitting ? "Проверка..." : "Применить код"}
              </button>
            </form>
            
            {submitMessage && (
              <div className={`mt-4 text-sm font-bold px-4 py-3 rounded-xl border ${submitMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {submitMessage.text}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="text-center space-y-2 mb-8 pt-6">
        <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-800">
          Пригласи друга
        </h3>
        <p className="text-sm font-medium text-slate-500 max-w-2xl mx-auto leading-relaxed">
          Ниже изображена карта, по которой вы сможете понять, за какое количество проданных материалов по реферальной ссылке вы сможете получить награду.
        </p>
      </div>

      <div className="mt-8">
        <ReferralTimeline 
          link={data.referral_link} 
          stats={data.stats} 
          track={data.track} 
          onClaimMilestone={handleClaimMilestone} 
        />
      </div>

      {unboxModalOpen && (
        <RewardUnboxModal
          isOpen={unboxModalOpen}
          items={unboxedItems}
          onClose={() => {
            setUnboxModalOpen(false);
            setUnboxedItems([]);
          }}
        />
      )}

      {choiceModalState.isOpen && (
        <MaterialChoiceModal
          isOpen={choiceModalState.isOpen}
          mode="referral"
          referralMilestoneId={choiceModalState.milestoneId}
          maxPrice={choiceModalState.maxPrice}
          requiredChoiceCount={choiceModalState.choiceCount}
          onClose={() => setChoiceModalState({ ...choiceModalState, isOpen: false })}
          onSuccess={handleChoiceSuccess}
        />
      )}
    </div>
  );
}