"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

// Импортируем визуальные компоненты заданий
import BlockRenderer from "@/app/(app)/projects/[slug]/assignment/components/BlockRenderer";
import QuestionTest from "@/app/(app)/projects/[slug]/assignment/components/QuestionTest";
import QuestionFill from "@/app/(app)/projects/[slug]/assignment/components/QuestionFill";
import QuestionSentence from "@/app/(app)/projects/[slug]/assignment/components/QuestionSentence";
import QuestionMatching from "@/app/(app)/projects/[slug]/assignment/components/QuestionMatching";
import QuestionImageMap from "@/app/(app)/projects/[slug]/assignment/components/QuestionImageMap";
import QuestionComplex from "@/app/(app)/projects/[slug]/assignment/components/QuestionComplex";
import QuestionCrossword from "@/app/(app)/projects/[slug]/assignment/components/QuestionCrossword";
import QuestionReading from "@/app/(app)/projects/[slug]/assignment/components/QuestionReading";
import ReviewPanel from "@/app/(app)/projects/[slug]/assignment/components/ReviewPanel";
import MediaRenderer from "@/app/(app)/projects/[slug]/assignment/components/MediaRenderer";

import "@/app/(app)/projects/[slug]/assignment/assignment.css";

type Props = {
  initialMaterial: any | null;
  initialAssignments: any[];
};

type ReviewData = {
  reviewItems: any[];
};

// Автономный клиентский генератор карточек разбора
function buildDemoReviewItems(questions: any[], answers: Record<string, any>): any[] {
  return questions.map((q: any) => {
    const uAns = answers[q.id];
    const isSkipped = uAns === undefined || uAns === null || uAns === "";

    if (q.type === "test") {
      const userIndices = Array.isArray(uAns) ? uAns.map(Number) : typeof uAns === "number" ? [uAns] : [];
      const correctIndices = Array.isArray(q.correct)
        ? q.correct.map(Number)
        : typeof q.correct === "number"
        ? [q.correct]
        : [];
      
      const isCorrect =
        userIndices.length > 0 &&
        userIndices.length === correctIndices.length &&
        userIndices.every((i: number) => correctIndices.includes(i));

      return {
        type: "test",
        questionText: q.q || "Тестовый вопрос",
        pointsEarned: isCorrect ? 1 : 0,
        pointsTotal: 1,
        isCorrect,
        isSkipped,
        options: q.options || [],
        userIndices,
        correctIndices,
        media: q.media || [],
      };
    }

    if (q.type === "fill") {
      const rawAnswers = Array.isArray(q.answers)
        ? q.answers
        : Array.isArray(q.correct)
        ? q.correct
        : [];
      
      const parts = rawAnswers.map((variants: any, idx: number) => {
        const uVal = String(uAns?.[idx] ?? "").trim().toLowerCase();
        const vArr = Array.isArray(variants) ? variants : [variants];
        const cVal = vArr
          .map((v: any) => (typeof v === "object" ? v.text || v.value || "" : String(v)))
          .join(" или ");
        
        const validOptions = cVal.toLowerCase().split(" или ");
        const isPartCorrect = uVal.length > 0 && validOptions.includes(uVal);
        return { user: uAns?.[idx] || "", correct: cVal, isCorrect: isPartCorrect };
      });

      const correctCount = parts.filter((p: any) => p.isCorrect).length;
      const totalCount = parts.length || 1;

      return {
        type: "fill",
        questionText: q.q || "Заполнение пропусков",
        pointsEarned: correctCount / totalCount,
        pointsTotal: 1,
        isCorrect: correctCount === totalCount,
        isSkipped,
        parts,
        media: q.media || [],
      };
    }

    return {
      type: q.type || "other",
      questionText: q.q || "Вопрос",
      pointsEarned: isSkipped ? 0 : 1,
      pointsTotal: 1,
      isCorrect: !isSkipped,
      isSkipped,
      media: q.media || [],
    };
  });
}

export default function DemoClient({ initialMaterial, initialAssignments }: Props) {
  const [material] = useState<any | null>(initialMaterial);
  const [assignments] = useState<any[]>(initialAssignments);
  
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [completedAssignments, setCompletedAssignments] = useState<Record<string, boolean>>({});
  const [reviews, setReviews] = useState<Record<string, ReviewData>>({});
  const [showCtaModal, setShowCtaModal] = useState<boolean>(false);

  const currentAssignment = assignments[activeIdx] || null;

  useEffect(() => {
    try {
      const savedAnswers = localStorage.getItem("demo_answers");
      const savedCompleted = localStorage.getItem("demo_completed");
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
      if (savedCompleted) setCompletedAssignments(JSON.parse(savedCompleted));
    } catch (e) {
      console.error("Ошибка чтения demo из localStorage", e);
    }
  }, []);

  const updateAnswer = (questionId: string, value: any) => {
    const nextAnswers: Record<string, any> = { ...answers, [questionId]: value };
    setAnswers(nextAnswers);
    try {
      localStorage.setItem("demo_answers", JSON.stringify(nextAnswers));
    } catch (e) {
      console.error(e);
    }
  };

  const handleFinishAssignment = () => {
    if (!currentAssignment) return;

    const questions = currentAssignment.content?.questions || [];
    let reviewData: ReviewData | null = null;

    if (currentAssignment.assignment_type !== "intro" && questions.length > 0) {
      const reviewItems = buildDemoReviewItems(questions, answers);
      reviewData = { reviewItems };
      setReviews((prev: Record<string, ReviewData>) => ({
        ...prev,
        [String(currentAssignment.id)]: reviewData as ReviewData,
      }));
    }

    const nextCompleted: Record<string, boolean> = {
      ...completedAssignments,
      [String(currentAssignment.id)]: true,
    };
    setCompletedAssignments(nextCompleted);
    localStorage.setItem("demo_completed", JSON.stringify(nextCompleted));

    const allDone = assignments.every((a) => nextCompleted[a.id]);
    if (allDone || activeIdx === assignments.length - 1) {
      setShowCtaModal(true);
    }
  };

  if (!material) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl mb-4">🎯</div>
        <h1 className="text-2xl font-bold mb-2">Демо-задание пока не настроено</h1>
        <p className="text-slate-400 max-w-md mb-6">Администратор еще не выделил демо-материал в системе.</p>
        <Link href="/login" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold transition-all">
          ← Вернуться к входу
        </Link>
      </div>
    );
  }

  const isCurrentCompleted = currentAssignment ? Boolean(completedAssignments[String(currentAssignment.id)]) : false;
  const currentQuestions = currentAssignment?.content?.questions || [];
  const currentBlocks = currentAssignment?.content?.blocks || [];
  const currentReview = currentAssignment?.id ? reviews[String(currentAssignment.id)] : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 font-sans">
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-2">
            ← На страницу входа
          </Link>
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase">
            ✦ Демо-режим без регистрации
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-8">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {material.cover_image_url && (
              <img src={material.cover_image_url} alt={material.title} className="w-24 h-24 rounded-2xl object-cover border border-slate-700 flex-shrink-0" />
            )}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-black mb-2">{material.title}</h1>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{material.description || "Ознакомительное демо-задание для проверки возможностей платформы"}</p>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500" 
                    style={{ width: `${assignments.length ? (Object.keys(completedAssignments).length / assignments.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {Object.keys(completedAssignments).length} / {assignments.length} вып.
                </span>
              </div>
            </div>
          </div>
        </div>

        {assignments.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
            {assignments.map((a, idx) => {
              const isDone = completedAssignments[a.id];
              const isActive = idx === activeIdx;
              return (
                <button
                  key={a.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all border ${
                    isActive
                      ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/20"
                      : isDone
                      ? "bg-slate-900 border-emerald-500/40 text-emerald-400"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850"
                  }`}
                >
                  {isDone ? "✓ " : ""}{idx + 1}. {a.title}
                </button>
              );
            })}
          </div>
        )}

        {currentAssignment && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-200 border-b border-slate-800 pb-4">
              {currentAssignment.title}
            </h2>

            {currentAssignment.assignment_type === "intro" ? (
              <BlockRenderer 
                blocks={currentBlocks} 
                onComplete={handleFinishAssignment}
                isSaving={false}
              />
            ) : (
              <div className="space-y-8">
                {currentQuestions.map((q: any, qIdx: number) => (
                  <div key={q.id || qIdx} className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 md:p-6">
                    <div className="text-xs font-bold text-blue-400 mb-2">Вопрос {qIdx + 1}</div>
                    
                    {q.q && <div className="text-lg font-bold text-slate-100 mb-4 whitespace-pre-wrap">{q.q}</div>}
                    {q.media && q.media.length > 0 && <div className="mb-4"><MediaRenderer media={q.media} /></div>}

                    {q.type === "test" && <QuestionTest question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "fill" && <QuestionFill question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "sentence" && <QuestionSentence question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "reading" && <QuestionReading question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "matching" && <QuestionMatching question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "imagemap" && <QuestionImageMap question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "complex" && <QuestionComplex question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                    {q.type === "crossword" && <QuestionCrossword question={q} value={answers[q.id]} onChange={(v) => updateAnswer(q.id, v)} disabled={isCurrentCompleted} />}
                  </div>
                ))}

                {!isCurrentCompleted ? (
                  <button
                    onClick={handleFinishAssignment}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg py-4 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.99]"
                  >
                    Завершить и проверить задание
                  </button>
                ) : (
                  currentReview && (
                    <div className="mt-8 border-t border-slate-800 pt-6">
                      <ReviewPanel items={currentReview.reviewItems || []} />
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {showCtaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
            <div className="text-6xl animate-bounce">🎉</div>
            <h2 className="text-2xl font-black text-white">Демо-задание пройдено!</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Понравилось решать интерактивные задания? Зарегистрируйтесь, чтобы открыть полный доступ ко всем курсам, сохранять историю и отслеживать свой прогресс!
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <Link href="/register" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30">
                🚀 Зарегистрироваться
              </Link>
              <Link href="/login" className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl transition-all">
                Войти в существующий аккаунт
              </Link>
              <button onClick={() => setShowCtaModal(false)} className="text-xs font-bold text-slate-500 hover:text-slate-400 mt-2">
                Закрыть и просмотреть результаты
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}