"use client";

import Modal from "@/components/Modal";

type Props = {
  open: boolean;
  mode: "process" | "unprocess";
};

export default function ProcessingModal({ open, mode }: Props) {
  return (
    <Modal open={open} onClose={() => {}} maxWidth={400} title="">
      <div className="text-center py-6 px-4">
        {/* Анимированный спиннер с использованием Tailwind (заменяет старый @keyframes) */}
        <div className="mx-auto w-12 h-12 rounded-full border-4 border-gray-100 border-t-blue-600 animate-spin mb-5 shadow-sm" />
        
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {mode === "process" ? "⏳ Заявки обрабатываются..." : "↩️ Заявки возвращаются..."}
        </h3>
        
        <p className="text-gray-500 text-sm leading-relaxed">
          Умный алгоритм сопоставляет уровни пользователей с базой материалов веток. <br/>
          <span className="font-medium text-gray-700">Пожалуйста, подождите и не закрывайте страницу.</span>
        </p>
      </div>
    </Modal>
  );
}