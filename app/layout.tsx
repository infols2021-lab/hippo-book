import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

export const metadata: Metadata = {
  title: "test_hippo_book",
  description: "Test HIPPO book on Next.js",
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
      <body>{children}</body>
    </html>
  );
}
