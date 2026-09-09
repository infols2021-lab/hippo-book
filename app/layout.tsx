// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

// Домен платёжной страницы Продамуса. Скрипт виджета лежит рядом с платёжной
// ссылкой: https://{store}.payform.ru/assets/widget/widget.js. Фолбэк на тот же
// субдомен, что и в PRODAMUS_STORE_URL (используется генератором платёжных ссылок).
const PRODAMUS_STORE_URL = (
  process.env.PRODAMUS_STORE_URL || "https://faustova.payform.ru"
)
  .trim()
  .replace(/\/+$/, "");

const PRODAMUS_WIDGET_SRC = `${PRODAMUS_STORE_URL}/assets/widget/widget.js`;

export const metadata: Metadata = {
  title: "skilLS — Образовательная онлайн-платформа",
  description: "Интерактивная подготовка к международным экзаменам и олимпиадам",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      lang="ru" 
      className="h-full bg-[var(--p-page-bg,#0b0f19)] m-0 p-0 font-sans"
    >
      <head>
        <link rel="stylesheet" href="/styles/base.css" />
        
        {/* Подключение шрифтов: Inter, Fraunces (сертификат) и IBM Plex Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;500;600;700;800;900&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="min-h-full m-0 p-0 flex flex-col bg-[var(--p-page-bg,#0b0f19)] text-white antialiased">
        {/* Виджет оплаты Продамуса: подгружается после интерактивности, чтобы не
            тормозить рендер. Инициализацию и открытие pop-up смотрим в RequestsClient. */}
        <Script
          strategy="lazyOnload"
          src={PRODAMUS_WIDGET_SRC}
          id="prodamus-payform-widget"
        />
        {children}
      </body>
    </html>
  );
}