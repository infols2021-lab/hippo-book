import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "test_hippo_book",
  description: "Test HIPPO book on Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        {/* Legacy styles from old HTML project */}
        <link rel="stylesheet" href="/styles/base.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
