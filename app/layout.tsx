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
    <html 
      lang="ru" 
      className={`${fontSans.variable} h-full bg-[var(--p-page-bg,#0b0f19)] m-0 p-0`}
    >
      <head>
        <link rel="stylesheet" href="/styles/base.css" />
      </head>
      <body className="min-h-full m-0 p-0 flex flex-col bg-[var(--p-page-bg,#0b0f19)] text-white antialiased">
        {children}
      </body>
    </html>
  );
}