// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "hipposha_book",
  description: "hipposha_book",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html 
      lang="ru" 
      // Убрали переменную шрифта, добавили стандартный font-sans
      className="h-full bg-[var(--p-page-bg,#0b0f19)] m-0 p-0 font-sans"
    >
      <head>
        <link rel="stylesheet" href="/styles/base.css" />
        
        {/* Железобетонное подключение шрифта Inter (решает баг Vercel) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

        {/* Прелоадинг графики для онбординга */}
        <link rel="preload" as="image" href="/images/tour/uki1.webp" />
        <link rel="preload" as="image" href="/images/tour/uki2.webp" />
        <link rel="preload" as="image" href="/images/tour/uki3.webp" />
        <link rel="preload" as="image" href="/images/tour/uki4.webp" />
        <link rel="preload" as="image" href="/images/tour/uki5.webp" />
        <link rel="preload" as="image" href="/images/tour/uki6.webp" />
        <link rel="preload" as="image" href="/images/tour/uki7.webp" />
        <link rel="preload" as="image" href="/images/tour/uki8.webp" />
      </head>
      <body className="min-h-full m-0 p-0 flex flex-col bg-[var(--p-page-bg,#0b0f19)] text-white antialiased">
        {children}
      </body>
    </html>
  );
}