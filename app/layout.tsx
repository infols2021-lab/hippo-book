import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

export const metadata: Metadata = {
  title: "hipposha_book",
  description: "hipposha_book",
};

const fontSans = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={fontSans.variable}>
      <head>
        <link rel="stylesheet" href="/styles/base.css" />
      </head>
      {/* 
        Добавлены flex-классы. 
        Это глобальный фикс выпадающих отступов (margin collapse), 
        убивающий белую полосу над хедером при любых динамических темах.
      */}
      <body className="flex flex-col min-h-screen m-0 p-0 overflow-x-hidden text-base antialiased">
        {children}
      </body>
    </html>
  );
}