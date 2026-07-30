// app/(admin)/admin/requests/ProcessingModal.tsx
"use client";

import Modal from "@/components/Modal";

type Props = {
  open: boolean;
  mode: "process" | "unprocess";
};

export default function ProcessingModal({ open, mode }: Props) {
  return (
    <Modal open={open} onClose={() => {}} maxWidth={420} title="">
      <div className="text-center py-6 px-4">
        {/* Спиннер с кольцевой анимацией Tailwind */}
        <div className="mx-auto w-12 h-12 rounded-full border-4 border-gray-100 border-t-indigo-600 animate-spin mb-5 shadow-sm" />

        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {mode === "process" ? "⏳ Выдача доступов..." : "↩️ Отмена доступов..."}
        </h3>

        <p className="text-gray-500 text-sm leading-relaxed">
          {mode === "process"
            ? "Выдаём доступы к выбранным материалам и обновляем реестр прав в базе данных."
            : "Возвращаем заявку в статус ожидания и обновляем права доступа пользователя."}
          <br />
          <span className="font-medium text-gray-700 block mt-2">
            Пожалуйста, подождите и не закрывайте страницу.
          </span>
        </p>
      </div>
    </Modal>
  );
}